import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/domain";

/**
 * Oturum acmis kullanicinin auth bilgisini + profiles satirini birlikte
 * getirir. Server Component / Server Action / Route Handler icinde
 * kullanilir. Proxy zaten girissiz kullaniciyi /login'e yonlendirir;
 * burasi ikinci (savunma katmani) kontroldur.
 *
 * DUZELTME (performans - "site kasiyor" siklikleri): bu fonksiyon HEM
 * (dashboard) layout'unda HEM de neredeyse her page.tsx / server action
 * icinde ayri ayri cagriliyor (requireProfile/requireAdmin). cache() sarmasi
 * OLMADAN her cagri kendi basina Supabase Auth sunucusuna gercek bir agirlik
 * (getUser() sadece cookie okumaz, JWT'yi dogrular) + ayri bir "profiles"
 * sorgusu yapiyordu - tek bir sayfa gorunumunde (layout + page) bu ikiser kez,
 * bazi admin sayfalarinda ucer kez tekrarlaniyordu. React'in cache() 'i AYNI
 * istek (request) icinde ayni argumanlarla yapilan cagrilari otomatik
 * hafizaya alir; istek bitince temizlenir - yani ETKI SADECE tek bir
 * sayfa/renders suresince gecerlidir, farkli kullanicilar/firmalar arasinda
 * ASLA veri sizdirmaz (staleTimes: 0 ile cakismaz, onu degistirmiyoruz).
 */
export type ProfileWithCompany = Profile & { company: { name: string } | null };

/**
 * Hesap kullanima kapali mi? (a) profil pasiflestirilmis ya da (b) firma
 * askiya alinmis. Firma pasifken RLS firma satirini (companies_select) gizler,
 * yani firma_id dolu ama `company` embed'i bos gelir. Veritabani zaten tum
 * veri erisimini keser (migration 0026); bu, kullaniciya dogru davranisi
 * (oturumu kapat + aciklayici mesaj) gostermek icin uygulama katmani kontroludur.
 */
export function isProfileBlocked(profile: ProfileWithCompany): boolean {
  if (!profile.is_active) return true;
  return profile.role !== "admin" && !!profile.company_id && !profile.company;
}

/**
 * PERF (jet hizi): eskiden bu fonksiyon (1) getUser() ile Supabase Auth'a ag
 * turu, (2) profiles sorgusu, ve layout'ta (3) ayri bir companies sorgusu
 * yapiyordu - ust uste 3 SIRALI ag turu. Simdi: (1) getClaims() JWT'yi YEREL
 * dogrular (ag turu yok, bkz. proxy.ts), (2) profil + firma adi TEK
 * sorguda (profiles -> companies iliskisi embed) gelir. Veri erisimi yine RLS
 * ile korunur (JWT her sorguda PostgREST'e gider).
 */
// GOZLEMLENEBILIRLIK (performans denetimi 2026-09-29): sadece 1sn+ suren
// adimlar loglanir (bkz. proxy.ts'teki ayni gerekce - gurultu yaratmadan
// bir sonraki "donma"da GERCEK sunucu suresini Hostinger loglarinda gormek).
function logIfSlow(label: string, startedAt: number) {
  const ms = Date.now() - startedAt;
  if (ms > 1000) console.warn(`[perf] getCurrentProfile: ${label} ${ms}ms`);
}

export const getCurrentProfile = cache(async (): Promise<ProfileWithCompany | null> => {
  const supabase = await createClient();

  const claimsStart = Date.now();
  const { data: claimsData } = await supabase.auth.getClaims();
  logIfSlow("getClaims()", claimsStart);
  const userId = claimsData?.claims?.sub;

  if (!userId) return null;

  const profileStart = Date.now();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, company:companies(name)")
    .eq("id", userId)
    .single();
  logIfSlow("profiles sorgusu", profileStart);

  return (profile as unknown as ProfileWithCompany | null) ?? null;
});

/**
 * getCurrentProfile'in "zorunlu" versiyonu: profil yoksa /login'e atar.
 * (dashboard) layout'u ve korumali sayfalar bunu kullanir.
 */
export async function requireProfile(): Promise<ProfileWithCompany> {
  const profile = await getCurrentProfile();
  // Oturum yok, profil yok (yarim kalmis hesap), pasif kullanici ya da askidaki firma:
  // /auth/inactive oturumu (gerekirse) kapatir ve /login'e mesajla yonlendirir.
  // (Dogrudan /login'e gitmek proxy'de "girisli kullanici /login'den atilir"
  // kuraliyla sonsuz yonlendirme dongusu olusturur.)
  if (!profile || isProfileBlocked(profile)) {
    redirect("/auth/inactive");
  }
  return profile;
}
