import { after } from "next/server";
import { headers } from "next/headers";
import { requireProfile } from "@/lib/auth/session";
import { getDueFollowups } from "@/lib/data/leads";
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
  const [profile, dueFollowups] = await Promise.all([requireProfile(), getDueFollowups()]);

  after(() => {
    logPerf({ requestId, layer: "page", op: `total:${pathname}`, durationMs: now() - pageStart, result: "success" });
  });

  return (
    <AppShell profile={profile} companyName={profile.company?.name ?? null} dueFollowups={dueFollowups}>
      {children}
    </AppShell>
  );
}
