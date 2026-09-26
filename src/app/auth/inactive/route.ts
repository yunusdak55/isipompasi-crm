import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Oturumu olan ama kullanimi engellenmis hesabi (pasif kullanici, askidaki
 * firma, profili olmayan yarim hesap) guvenle cikisa yonlendirir.
 *
 * Neden ayri bir rota: Server Component'ten cookie silinemez; dogrudan /login'e
 * yonlendirmek de proxy'nin "girisli kullaniciyi /login'den gonder" kurali
 * yuzunden sonsuz donguye yol acar. Buradaki GET, yalnizca hesap GERCEKTEN
 * engelliyse oturumu kapatir - baska bir siteden tetiklenen "zorla cikis"
 * (logout CSRF) etkisiz kalir.
 */
export async function GET(request: NextRequest) {
  const toLogin = (error?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = error ? `?error=${error}` : "";
    return NextResponse.redirect(url);
  };

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return toLogin();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, company_id, is_active, company:companies(name)")
    .eq("id", userId)
    .maybeSingle();

  const blocked =
    !profile ||
    !profile.is_active ||
    (profile.role !== "admin" && !!profile.company_id && !profile.company);

  if (!blocked) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  await supabase.auth.signOut();
  return toLogin(!profile ? "no_profile" : "inactive");
}
