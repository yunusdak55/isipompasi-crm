import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Her istekte calisir:
 *  1) Supabase oturum cookie'sini tazeler (refresh token rotasyonu).
 *  2) Girisi olmayan kullaniciyi korumali sayfalardan /login'e yonlendirir.
 *  3) Girisi olan kullaniciyi /login'den /dashboard'a yonlendirir.
 *
 * Bu, guvenligin TEK katmani DEGILDIR: her sayfa/route da kendi icinde
 * oturum ve rol kontrolu yapar, veritabani erisimi RLS ile korunur.
 * Middleware sadece hizli/erken bir yonlendirme katmanidir.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

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
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
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
  // getUser()'a geri duser.
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims ?? null;

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login");
  const isPublicAsset = pathname.startsWith("/_next") || pathname.startsWith("/favicon");
  const isProtectedRoute = !isAuthRoute && !isPublicAsset && pathname !== "/";

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

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
