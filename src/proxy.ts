import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildInstrumentedFetch } from "@/lib/supabase/fetch-with-timeout";
import { withTimeout, SessionCheckTimeoutError } from "@/lib/supabase/with-timeout";
import { logPerf, newRequestId } from "@/lib/perf-log";

/**
 * Her istekte calisir (Next.js 16: eski adiyla middleware):
 *  1) Supabase oturum cookie'sini tazeler (refresh token rotasyonu).
 *  2) Girisi olmayan kullaniciyi korumali sayfalardan /login'e yonlendirir.
 *  3) Girisi olan kullaniciyi /login'den /dashboard'a yonlendirir.
 *  4) Her sayfa yanitina, istek basina rastgele bir NONCE'li Content-Security-Policy
 *     ekler (XSS'e karsi ek katman: nonce'suz/enjekte edilmis script calismaz).
 *
 * Bu, guvenligin TEK katmani DEGILDIR: her sayfa/route da kendi icinde
 * oturum ve rol kontrolu yapar, veritabani erisimi RLS ile korunur.
 * Proxy sadece hizli/erken bir yonlendirme + basliklar katmanidir.
 */

/**
 * CSP. Notlar:
 *  - script-src 'nonce' + 'strict-dynamic': yalnizca sunucunun nonce verdigi
 *    (ve onlarin yukledigi) script'ler calisir. Sayfalarin DINAMIK render
 *    edilmesi gerekir (bkz. app/layout.tsx `connection()`), aksi halde nonce yok.
 *  - style-src 'unsafe-inline': React `style={{...}}` nitelikleri (grafikler)
 *    nonce ile calismaz; stil enjeksiyonu script kadar kritik degildir.
 *  - connect-src 'self': tarayici Supabase'e HIC dogrudan baglanmaz (tum veri
 *    sunucu tarafi); bir XSS veriyi disariya sizdiramaz.
 *  - frame-ancestors 'none': tiklama-hirsizligi (clickjacking) engeli.
 */
function buildCsp(nonce: string, isHttps: boolean) {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isHttps && !isDev ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const middlewareStart = Date.now();
  // GOZLEMLENEBILIRLIK (3. tur, bkz. lib/perf-log.ts): bu istek icin TEK bir
  // kisa kimlik uretilip `x-request-id` header'iyla sayfa render'ina
  // tasinir - Server Component'lerdeki (server.ts) Supabase cagrilari
  // AYNI id'yi kullanarak Hostinger loglarinda tek bir zincir olusturur:
  // [PERF][abc12345] layer=middleware ... , [PERF][abc12345] layer=supabase table=profiles ...
  const requestId = newRequestId();
  const nonce = btoa(crypto.randomUUID());
  const isHttps = request.headers.get("x-forwarded-proto") === "https" || request.nextUrl.protocol === "https:";
  const csp = buildCsp(nonce, isHttps);
  // Acil durum anahtari: CSP beklenmedik bir seyi engellerse (ortam degiskeni CSP_REPORT_ONLY=1)
  // ilke yalnizca RAPOR modunda uygulanir (hicbir sey engellenmez, tarayici konsoluna yazar).
  const cspHeaderName = process.env.CSP_REPORT_ONLY === "1" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";

  // Next.js nonce'u ISTEK basligindaki CSP'den okuyup kendi script'lerine ekler.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(cspHeaderName, csp);
  requestHeaders.set("x-request-id", requestId);
  // GOZLEMLENEBILIRLIK: sayfa-seviyesi toplam sure loglarinda ("layer=page")
  // hangi rotanin yavas oldugunu gorebilmek icin (bkz. (dashboard)/layout.tsx).
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // PERF (donma duzeltmesi, bkz. lib/supabase/fetch-with-timeout.ts): bu
      // istemci HER istekte calisir (middleware) - zaman asimi olmadan burada
      // askida kalan bir istek TUM SITEYI donma noktasi haline getirirdi.
      // GOZLEMLENEBILIRLIK: bu requestId ile uretilen instrumented fetch,
      // buradan gecen HER Supabase cagrisini (auth_jwks_fetch, auth_token_refresh...)
      // otomatik loglar (bkz. fetch-with-timeout.ts).
      global: { fetch: buildInstrumentedFetch(requestId) },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Tazelenen oturum cookie'leri sayfa render'ina da ulassin (nonce/CSP basliklariyla birlikte).
          requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, { ...options, httpOnly: true, secure: isHttps, sameSite: "lax" })
          );
        },
      },
    }
  );

  // PERF (jet hizi): getUser() HER istekte Supabase Auth sunucusuna gercek bir
  // ag turu (~80-200ms) yapiyordu. getClaims() JWT'nin IMZASINI asimetrik
  // (ES256) acik anahtarla YEREL olarak dogrular (anahtar seti bir kere
  // cekilip bellekte tutulur) - ag turu YOK. Imza + sure hala dogrulanir,
  // sahte/suresi dolmus token reddedilir; veri erisimi ayrica her sorguda
  // PostgREST/RLS tarafindan yeniden dogrulanir. Tek ODUN: oturumu sunucuda
  // iptal edilen (cikis yapilan) bir token, suresi (1 saat) dolana kadar
  // gecerli sayilir - simetrik anahtarli projelerde kutuphane otomatik
  // getUser()'a geri duser. Pasif kullanici/firma ise ayrica veritabani
  // katmaninda (RLS yardimcilari) ANINDA kesilir, bkz. migration 0026.
  // DUZELTME (canli kanit 2026-09-30, bkz. with-timeout.ts): buradaki ham
  // fetch zaten 10sn'de kesiliyor (fetch-with-timeout.ts) ama GoTrueClient
  // bunu KENDI ICINDE gorunmez sekilde ~30sn'ye kadar tekrar deniyor - bu
  // sarmalayici olmadan Hostinger<->Supabase arasi gecici bir tikaniklikta
  // TUM SITE (her istek burdan gecer) dakikalarca "donmus" gorunebiliyordu.
  const claimsStart = Date.now();
  let user: { sub?: string } | null = null;
  try {
    const { data: claimsData } = await withTimeout(supabase.auth.getClaims(), "middleware:getClaims");
    logPerf({ requestId, layer: "middleware", op: "getClaims", durationMs: Date.now() - claimsStart, result: "success" });
    user = claimsData?.claims ?? null;
  } catch (e) {
    const isTimeout = e instanceof SessionCheckTimeoutError;
    logPerf({ requestId, layer: "middleware", op: "getClaims", durationMs: Date.now() - claimsStart, result: isTimeout ? "timeout" : "error" });
    // GUVENLI TARAF: oturum dogrulanamadiysa "girisli degil" sayilir - en
    // kotu ihtimalle gecerli bir kullanici nadir bir ag tikanikliginda
    // login'e yonlendirilir (can sikici ama guvenli), "oturum var say" ASLA
    // yapilmaz (guvenlik acigi olurdu).
    user = null;
  }

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login");
  // /auth/* (callback, inactive): oturum acmamis kullanicinin da ulasabilmesi gerekir.
  const isOpenRoute =
    pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.startsWith("/auth/") || pathname === "/robots.txt";
  const isProtectedRoute = !isAuthRoute && !isOpenRoute && pathname !== "/";

  // GOZLEMLENEBILIRLIK: middleware'in TOPLAM suresi - hangi cikis yolundan
  // donerse donsun tek bir yerden loglanir (bkz. lib/perf-log.ts).
  const finish = (response: NextResponse) => {
    logPerf({ requestId, layer: "middleware", op: "total", durationMs: Date.now() - middlewareStart, result: "success" });
    return response;
  };

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return finish(NextResponse.redirect(url));
  }

  if (user && isAuthRoute) {
    // "/" rol'e gore dogru ilk sayfaya yonlendirir (admin -> firmalar, digerleri -> dashboard).
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return finish(NextResponse.redirect(url));
  }

  supabaseResponse.headers.set(cspHeaderName, csp);
  return finish(supabaseResponse);
}

export const config = {
  matcher: [
    /*
     * Asagidakiler HARIC tum istek yollarinda calis:
     * - _next/static, _next/image (Next.js dahili dosyalari)
     * - favicon.ico, resim uzantilari
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
