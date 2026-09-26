import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import type { Database } from "@/lib/types/database.types";

/**
 * Server Component / Server Action / Route Handler icinde kullanilacak
 * Supabase client'i. Oturum cookie'lerini next/headers uzerinden okur/yazar.
 *
 * NOT: Bu client de anon/publishable anahtari kullanir; yani RLS aktiftir.
 * Secret key (service role) burada KULLANILMAZ - o sadece admin islemleri
 * icin ayri, acikca isaretlenmis sunucu kodunda kullanilmalidir.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const isHttps = (await headers()).get("x-forwarded-proto") === "https";

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            // GUVENLIK: oturum cookie'leri HttpOnly - tarayici JS'i (olasi bir XSS dahil)
            // jetonlari OKUYAMAZ. Tarayicida Supabase istemcisi kullanilmiyor
            // (tum veri sunucu tarafi), yani bu hicbir islevi bozmaz.
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, { ...options, httpOnly: true, secure: isHttps, sameSite: "lax" })
            );
          } catch {
            // Bir Server Component icinden cagrildiginda cookie set edilemez.
            // Proxy zaten her istekte oturumu tazeledigi icin bu yoksayilabilir.
          }
        },
      },
    }
  );
}
