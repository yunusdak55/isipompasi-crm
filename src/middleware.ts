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

  // getUser() JWT'yi Supabase Auth sunucusunda dogrular (guvenli).
  // getSession() SADECE cookie'yi okur, dogrulamaz - server tarafinda kullanilmamali.
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
