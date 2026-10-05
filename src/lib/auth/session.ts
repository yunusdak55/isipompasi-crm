import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withTimeout, SessionCheckTimeoutError } from "@/lib/supabase/with-timeout";
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
// GOZLEMLENEBILIRLIK: bu fonksiyondaki her Supabase cagrisi (getClaims'in
// JWKS agirlik cekebilecek ilk cagrisi, profiles sorgusu) zaten
// createClient()'in instrumented fetch'i uzerinden otomatik + requestId'li
// olarak loglanir (bkz. lib/supabase/server.ts, lib/supabase/fetch-with-timeout.ts) -
// burada ayrica manuel suresi olcup loglamaya gerek yok (yinelenen/asenkron
// requestId'siz log gurultusu olurdu).
/**
 * Istek basina TEK getClaims() (JWT yerel dogrulanir, ag turu yok): hem profil
 * hem rol okuyan kod ayni sonucu paylasir. cache() = ayni istek icinde tekrar
 * hesaplanmaz, istekler arasi veri sizdirmaz.
 */
const getClaimsCached = cache(async () => {
  const supabase = await createClient();
  return supabase.auth.getClaims();
});

/**
 * Oturum JWT'sindeki (app_metadata) rol - VERITABANI sorgusu atmadan. Yalnizca
 * "hangi hatirlatma sorgusunu atayim" gibi OPTIMIZASYON ipuclari icindir;
 * yetki karari icin ASLA kullanilmaz (yetki = RLS + requireProfile'daki profil).
 */
export async function getClaimsRoleHint(): Promise<string | null> {
  try {
    const { data } = await withTimeout(getClaimsCached(), "getClaimsRoleHint");
    const role = (data?.claims as { app_metadata?: { role?: unknown } } | undefined)?.app_metadata?.role;
    return typeof role === "string" ? role : null;
  } catch {
    return null;
  }
}

/**
 * Oturum JWT'sindeki (app_metadata) firma kimligi - VERITABANI sorgusu atmadan.
 * getClaimsRoleHint ile AYNI kural: yalnizca "veriyi profili beklemeden baslat"
 * optimizasyonu icindir; yetki = RLS + requireProfile'daki profil. Ipucu yanlis/
 * eski olsa bile RLS baska firmanin satirini dondurmez.
 */
export async function getClaimsCompanyHint(): Promise<string | null> {
  try {
    const { data } = await withTimeout(getClaimsCached(), "getClaimsCompanyHint");
    const companyId = (data?.claims as { app_metadata?: { company_id?: unknown } } | undefined)?.app_metadata?.company_id;
    return typeof companyId === "string" ? companyId : null;
  } catch {
    return null;
  }
}

async function getCurrentProfileInner(): Promise<ProfileWithCompany | null> {
  const supabase = await createClient();

  const { data: claimsData } = await getClaimsCached();
  const userId = claimsData?.claims?.sub;

  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, company:companies(name)")
    .eq("id", userId)
    .single();

  return (profile as unknown as ProfileWithCompany | null) ?? null;
}

// DUZELTME (canli kanit 2026-09-30, bkz. lib/supabase/with-timeout.ts): tek
// bir sayfa navigasyonunda ttfb=392sn olculdu - GoTrueClient'in gorunmez ic
// tekrar mantigi, buradaki getClaims()+profil sorgusunu (TUM korumali
// sayfalarin gectigi TEK nokta) dakikalarca askida birakabiliyordu. Sert bir
// UST SINIR ile sarmalaniyor - asilirsa getCurrentProfile REJECT eder
// (SessionCheckTimeoutError), requireProfile bunu net bir "bağlantı sorunu"
// sayfasina yonlendirir (asagida) - /auth/inactive'e DEGIL, cunku o rota
// KENDI ayri getClaims()+profil sorgusunu yapar ve AYNI tikanikliga
// yakalanabilir.
export const getCurrentProfile = cache(async (): Promise<ProfileWithCompany | null> => {
  return withTimeout(getCurrentProfileInner(), "getCurrentProfile");
});

/**
 * getCurrentProfile'in "zorunlu" versiyonu: profil yoksa /login'e atar.
 * (dashboard) layout'u ve korumali sayfalar bunu kullanir.
 */
export async function requireProfile(): Promise<ProfileWithCompany> {
  let profile: ProfileWithCompany | null;
  try {
    profile = await getCurrentProfile();
  } catch (error) {
    if (error instanceof SessionCheckTimeoutError) {
      redirect("/auth/connection-error");
    }
    throw error;
  }
  // Oturum yok, profil yok (yarim kalmis hesap), pasif kullanici ya da askidaki firma:
  // /auth/inactive oturumu (gerekirse) kapatir ve /login'e mesajla yonlendirir.
  // (Dogrudan /login'e gitmek proxy'de "girisli kullanici /login'den atilir"
  // kuraliyla sonsuz yonlendirme dongusu olusturur.)
  if (!profile || isProfileBlocked(profile)) {
    redirect("/auth/inactive");
  }
  return profile;
}

/**
 * Profil + firmaya bagli veriyi TEK ag turunda getirir (olcum 2026-10-05: her sayfa
 * gecisinde once profil sorgusu bekleniyor, veri ANCAK ondan sonra isteniyordu =
 * tiklama basina bosuna bir tur). `load` profili beklemeden, JWT'deki firma
 * ipucuyla baslatilir; ipucu profildeki firmayla uyusmazsa (nadir: firma yeni
 * degismis, JWT eski) dogru firmayla yeniden cekilir. Firmasi olmayan kullanici
 * (admin) icin `data` null doner.
 */
export async function requireProfileWithCompanyData<T>(
  load: (companyId: string) => Promise<T>
): Promise<{ profile: ProfileWithCompany; data: T | null }> {
  const hint = await getClaimsCompanyHint();
  const [profile, early] = await Promise.all([requireProfile(), hint ? load(hint) : Promise.resolve(null)]);
  if (!profile.company_id) return { profile, data: null };
  if (hint === profile.company_id) return { profile, data: early };
  return { profile, data: await load(profile.company_id) };
}
