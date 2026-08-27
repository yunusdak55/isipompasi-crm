import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase'in e-posta onayi / magic link / OAuth akislarinda yonlendirdigi
 * geri cagirma (callback) rotasi. V1'de sadece e-posta+sifre girisi
 * kullanilsa da, bu rota ileride bu akislarin sorunsuz eklenebilmesi
 * icin baştan hazir tutulur (spec md.32: mimari ileride eklemeye engel olmasin).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
