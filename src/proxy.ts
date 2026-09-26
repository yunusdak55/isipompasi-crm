import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
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
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims ?? null;

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login");
  // /auth/* (callback, inactive): oturum acmamis kullanicinin da ulasabilmesi gerekir.
  const isOpenRoute =
    pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.startsWith("/auth/") || pathname === "/robots.txt";
  const isProtectedRoute = !isAuthRoute && !isOpenRoute && pathname !== "/";

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    // "/" rol'e gore dogru ilk sayfaya yonlendirir (admin -> firmalar, digerleri -> dashboard).
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  supabaseResponse.headers.set(cspHeaderName, csp);
  return supabaseResponse;
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
