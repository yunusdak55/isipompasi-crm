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

  let profile;
  try {
    profile = await getCurrentProfile();
  } catch {
    // Oturum dogrulamasi zaman asimina ugradi: istemci eski veriyi gostermeye devam eder.
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  }
  if (!profile || isProfileBlocked(profile) || profile.role === "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  }

  const today = await getDashboardToday();
  if (!today.ok) {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  }
  return NextResponse.json({ today, now: Date.now() }, { headers });
}
