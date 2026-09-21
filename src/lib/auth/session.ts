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
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  return profile;
});

/**
 * getCurrentProfile'in "zorunlu" versiyonu: profil yoksa /login'e atar.
 * (dashboard) layout'u ve korumali sayfalar bunu kullanir.
 */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  return profile;
}
