import { redirect } from "next/navigation";
import { AgentChat } from "@/components/agent/agent-chat";
import { requireProfile } from "@/lib/auth/session";

/**
 * Dijital Ajan — TEK bolum (spec 2026-09-28/30). GORSEL REVIZYON
 * (2026-09-30): sayfanin kendi ayrı basligi kaldirildi - AgentChat'in
 * kendi icinde zaten bir baslik (kucuk avatar + isim + rozet) var, iki
 * ayri baslik ustuste durmasin diye (spec: "chat kısmını büyüt"). Sayfa
 * artik SADECE tek, buyuk, tum yuksekligi kaplayan sohbet paneli.
 *
 * UYARILAR KALDIRILDI (spec 2026-10-06: "uyarıları sil, sorunca söyler zaten"):
 * eskiden sohbet, sistemin kendi tespit ettigi 5-8 uyari kartiyla doluyordu ve
 * bunun icin sayfa acilisinda 14 sorguluk ozet cekiliyordu. Artik sohbet bos
 * acilir; ozet yalnizca soru sorulunca, cevabin arka planinda hesaplanir
 * (bkz. agent/actions.ts askAgentAction).
 */
export default async function AgentOverviewPage() {
  const profile = await requireProfile();
  // DUZELTME (denetim bulgusu, bkz. dashboard/page.tsx ayni aciklama).
  if (profile.role === "admin") {
    redirect("/admin/companies");
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-6rem)] flex-col">
      <AgentChat companyName={profile.company?.name ?? null} />
    </div>
  );
}
