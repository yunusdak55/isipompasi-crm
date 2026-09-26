import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Yalnizca UYGULAMA ICI, guvenli bir yol kabul eder. Eskiden `next` dogrudan
 * `${origin}${next}` olarak birlestiriliyordu: `?next=@evil.com` ya da
 * `?next=.evil.com` ile kullanici baska bir siteye yonlendirilebiliyordu
 * (open redirect / kimlik avi). Sadece tek "/" ile baslayan, "//" veya "\"
 * icermeyen yollar gecerlidir.
 */
function safeNextPath(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || /[\u0000-\u001f]/.test(raw)) {
    return "/dashboard";
  }
  return raw;
}

/**
 * Supabase'in e-posta onayi / magic link / OAuth akislarinda yonlendirdigi
 * geri cagirma (callback) rotasi. V1'de sadece e-posta+sifre girisi
 * kullanilsa da, bu rota ileride bu akislarin sorunsuz eklenebilmesi
 * icin baştan hazir tutulur (spec md.32: mimari ileride eklemeye engel olmasin).
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const url = request.nextUrl.clone();
      url.pathname = next.split("?")[0];
      url.search = next.includes("?") ? `?${next.split("?").slice(1).join("?")}` : "";
      return NextResponse.redirect(url);
    }
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "?error=auth_callback";
  return NextResponse.redirect(url);
}
