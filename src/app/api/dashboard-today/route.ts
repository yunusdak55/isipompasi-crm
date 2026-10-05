import { NextResponse } from "next/server";
import { getCurrentProfile, isProfileBlocked } from "@/lib/auth/session";
import { getDashboardToday } from "@/lib/data/dashboard";

/**
 * Dashboard "Bugun" verisinin HAFIF yenileme ucu (bkz. components/dashboard/
 * dashboard-live.tsx). Eskiden otomatik yenileme `router.refresh()` idi: o,
 * layout'u (profil + zil sorgulari) yeniden render ediyor, istemcinin prefetch
 * onbellegini siliyor ve gorunen TUM linkleri yeniden prefetch ettiriyordu
 * (canli olcum 2026-10-05: bosta duran Dashboard 117 sn'de 64 istek). Bu uc
 * TEK istek + TEK RPC'dir ve router'a hic dokunmaz.
 *
 * GUVENLIK: sayfayla AYNI kontroller - oturum + aktif profil sart, admin'in
 * firma verisi yok (sayfa da admin'i yonlendirir). Veri RLS'li kullanici
 * istemcisiyle okunur (service role YOK). Yanit asla onbelleklenmez.
 */
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };

  // PERF (olcum 2026-10-05: 2 sirali ag turu, ~200 ms): profil ile veri ayni turda.
  // Veri RLS'li oturumla okunur ve asagidaki kontroller gecmeden ASLA dondurulmez.
  const [auth, today] = await Promise.all([
    getCurrentProfile().then(
      (profile) => ({ ok: true as const, profile }),
      // Oturum dogrulamasi zaman asimina ugradi: istemci eski veriyi gostermeye devam eder.
      () => ({ ok: false as const, profile: null })
    ),
    getDashboardToday(),
  ]);
  if (!auth.ok) {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  }
  const { profile } = auth;
  if (!profile || isProfileBlocked(profile) || profile.role === "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  }

  if (!today.ok) {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  }
  return NextResponse.json({ today, now: Date.now() }, { headers });
}
