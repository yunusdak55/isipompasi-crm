import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/domain";

/**
 * Oturum acmis kullanicinin auth bilgisini + profiles satirini birlikte
 * getirir. Server Component / Server Action / Route Handler icinde
 * kullanilir. Middleware zaten girissiz kullaniciyi /login'e yonlendirir;
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
 * PERF (jet hizi): eskiden bu fonksiyon (1) getUser() ile Supabase Auth'a ag
 * turu, (2) profiles sorgusu, ve layout'ta (3) ayri bir companies sorgusu
 * yapiyordu - ust uste 3 SIRALI ag turu. Simdi: (1) getClaims() JWT'yi YEREL
 * dogrular (ag turu yok, bkz. middleware.ts), (2) profil + firma adi TEK
 * sorguda (profiles -> companies iliskisi embed) gelir. Veri erisimi yine RLS
 * ile korunur (JWT her sorguda PostgREST'e gider).
 */
export const getCurrentProfile = cache(async (): Promise<ProfileWithCompany | null> => {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, company:companies(name)")
    .eq("id", userId)
    .single();

  return (profile as unknown as ProfileWithCompany | null) ?? null;
});

/**
 * getCurrentProfile'in "zorunlu" versiyonu: profil yoksa /login'e atar.
 * (dashboard) layout'u ve korumali sayfalar bunu kullanir.
 */
export async function requireProfile(): Promise<ProfileWithCompany> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  return profile;
}
