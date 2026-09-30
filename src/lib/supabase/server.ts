import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import type { Database } from "@/lib/types/database.types";
import { buildInstrumentedFetch } from "@/lib/supabase/fetch-with-timeout";

/**
 * Server Component / Server Action / Route Handler icinde kullanilacak
 * Supabase client'i. Oturum cookie'lerini next/headers uzerinden okur/yazar.
 *
 * NOT: Bu client de anon/publishable anahtari kullanir; yani RLS aktiftir.
 * Secret key (service role) burada KULLANILMAZ - o sadece admin islemleri
 * icin ayri, acikca isaretlenmis sunucu kodunda kullanilmalidir.
 *
 * DUZELTME (kok neden, canli kanit 2026-09-30, bkz. lib/supabase/with-timeout.ts):
 * 392sn'lik donmanin ASIL nedeni sadece "ag bazen yavas" degildi - her
 * createClient() cagrisi YENI bir GoTrueClient ORNEGI yaratiyordu (aynı sayfa
 * yuklemesinde middleware + profil + firma verisi + sayfa sorgulari, 5-8 ayrı
 * ornek). Supabase SDK'sinin kendi kaynagi: getSession()/getClaims() token
 * suresi dolmaya <90sn kaldiysa (EXPIRY_MARGIN_MS) OTOMATIK yenileme dener
 * (autoRefreshToken ayarindan BAGIMSIZ - bkz. GoTrueClient.js __loadSession).
 * SDK'nin kendi "tek-ucus" (single-flight) korumasi VAR ama sadece AYNI
 * istemci orneginde calisir (bkz. GoTrueClient.js: "refresh single-flight").
 * Farkli ornekler bunu PAYLASMAZ - ag gecici tikandiginda HER biri KENDI
 * ~30sn'lik yeniden deneme dongüsunu bagimsiz baslatip ust uste biniyordu.
 * React'in cache()'i ile bu fonksiyon istek basina TEK ORNEGE indirgenir -
 * SDK'nin zaten var olan tek-ucus korumasi artik TUM istek boyunca gecerli
 * olur, N bagimsiz deneme yerine sadece 1 tane olusur.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const isHttps = requestHeaders.get("x-forwarded-proto") === "https";
  // GOZLEMLENEBILIRLIK: proxy.ts'te uretilip x-request-id basligiyla tasinan
  // kimlik - bu sayfa yuklemesindeki Supabase cagrilarini Hostinger
  // loglarinda middleware/proxy zinciriyle ayni [PERF][xxxxxxxx] etiketi
  // altinda birlestirir (bkz. lib/perf-log.ts).
  const requestId = requestHeaders.get("x-request-id") ?? undefined;

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // PERF (donma duzeltmesi, bkz. fetch-with-timeout.ts): ag istegi askida
      // kalirsa 10sn'de basarisiz olsun, sonsuza kadar beklemesin.
      global: { fetch: buildInstrumentedFetch(requestId) },
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
});
