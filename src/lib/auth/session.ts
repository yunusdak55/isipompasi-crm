import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/domain";

/**
 * Oturum acmis kullanicinin auth bilgisini + profiles satirini birlikte
 * getirir. Server Component / Server Action / Route Handler icinde
 * kullanilir. Middleware zaten girissiz kullaniciyi /login'e yonlendirir;
 * burasi ikinci (savunma katmani) kontroldur.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  return profile;
}

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
