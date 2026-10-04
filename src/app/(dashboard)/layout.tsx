import { after } from "next/server";
import { headers } from "next/headers";
import { getClaimsRoleHint, requireProfile } from "@/lib/auth/session";
import { getDueFollowups } from "@/lib/data/leads";
import { getDueProspectFollowups } from "@/lib/data/prospects";
import { AppShell } from "@/components/layout/app-shell";
import { logPerf, now } from "@/lib/perf-log";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // GOZLEMLENEBILIRLIK: bu layout TUM (dashboard) sayfalarini sarar, yani
  // burada olculen sure = sayfanin (layout + page, ayni render/istek dongusu)
  // TOPLAM suresi. requestId/pathname proxy.ts'ten header ile gelir; `after()`
  // yaniti YAVASLATMADAN, kullaniciya gonderildikten SONRA calisir (bkz.
  // node_modules/next/dist/docs/.../after.md - Server Component icinde
  // headers()/cookies() after() CAGRISI ICINDE degil, ONCESINDE okunmali).
  const pageStart = now();
  const requestHeaders = await headers();
  const requestId = requestHeaders.get("x-request-id") ?? undefined;
  const pathname = requestHeaders.get("x-pathname") ?? "unknown";

  // Girisi olmayan kullanici burada /login'e yonlendirilir (proxy'ye ek
  // ikinci savunma katmani - spec md.28 guvenlik oncelikli).
  //
  // PERF (jet hizi): profil (+ firma adi, tek sorguda embed) ile hatirlatma
  // zili verisi BIRBIRINE BAGIMLI DEGIL - eskiden art arda (profil -> firma ->
  // hatirlatmalar, 3 sirali ag turu) bekleniyordu, simdi PARALEL (tek tur).
  // Admin icin zil AJANSIN kendi aday takiplerini (agency_prospects) listeler;
  // firma kullanicilari icin lead takiplerini. Eskiden ikisi de HER sayfada
  // atiliyordu (digeri RLS geregi bos donse de bos bir veritabani turu + RLS
  // degerlendirmesi demekti). Simdi rol JWT'den (sorgusuz) tahmin edilir ve
  // YALNIZCA ilgili sorgu profille paralel atilir; tahmin profille uyusmazsa
  // (nadir: rol yeni degismis, JWT eski) dogru sorgu ardindan calistirilir.
  const guessedAdmin = (await getClaimsRoleHint()) === "admin";
  const [profile, guessedReminders] = await Promise.all([
    requireProfile(),
    guessedAdmin ? getDueProspectFollowups() : getDueFollowups(),
  ]);
  const isAdmin = profile.role === "admin";
  const dueFollowups =
    isAdmin === guessedAdmin ? guessedReminders : isAdmin ? await getDueProspectFollowups() : await getDueFollowups();

  after(() => {
    logPerf({ requestId, layer: "page", op: `total:${pathname}`, durationMs: now() - pageStart, result: "success" });
  });

  return (
    <AppShell profile={profile} companyName={profile.company?.name ?? null} dueFollowups={dueFollowups}>
      {children}
    </AppShell>
  );
}
