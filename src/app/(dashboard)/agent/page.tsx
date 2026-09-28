import { AgentChat } from "@/components/agent/agent-chat";
import { getAgentDigest, buildAgentInsights } from "@/lib/data/agent-digest";
import { requireProfile } from "@/lib/auth/session";

/**
 * Dijital Ajan — TEK bolum (spec 2026-09-28/30). GORSEL REVIZYON
 * (2026-09-30): sayfanin kendi ayrı basligi kaldirildi - AgentChat'in
 * kendi icinde zaten bir baslik (kucuk avatar + isim + rozet) var, iki
 * ayri baslik ustuste durmasin diye (spec: "chat kısmını büyüt"). Sayfa
 * artik SADECE tek, buyuk, tum yuksekligi kaplayan sohbet paneli.
 */
export default async function AgentOverviewPage() {
  const [profile, digest] = await Promise.all([requireProfile(), getAgentDigest()]);
  const insights = buildAgentInsights(digest);

  return (
    <div className="flex h-full min-h-[calc(100vh-6rem)] flex-col">
      <AgentChat insights={insights} companyName={profile.company?.name ?? null} />
    </div>
  );
}
