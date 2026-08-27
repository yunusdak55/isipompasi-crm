import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AgentChatPanel } from "@/components/agent/agent-chat-panel";

export default function AgentCompetitorsPage() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <Link
        href="/agent"
        className="group inline-flex w-fit items-center gap-1.5 text-sm text-ink-600 transition-colors duration-150 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-150 ease-snappy group-hover:-translate-x-0.5" />
        Dijital Ajan
      </Link>

      <div className="min-h-0 flex-1">
        <AgentChatPanel
          title="Rakip Analizi"
          description="Rakiplerinizin kampanyalarını ve konumlandırmalarını takip edin."
          introHeadline="Rakiplerimi analiz ediyorum."
          introBody="Rakipleriniz hakkında bir soru sorun - ileride n8n + AI agent bu alanı gerçek verilerle dolduracak."
          suggestedQuestions={[
            "Rakiplerim şu anda hangi kampanyaları öne çıkarıyor?",
            "Rakiplerimin teklif ve konumlandırmalarında öne çıkan noktalar neler?",
            "Rakiplerime karşı hangi avantajlarla öne çıkabilirim?",
          ]}
          placeholder="Rakipleriniz hakkında bir soru yazın…"
          connectionNote="Rakip Analizi ileride n8n + AI agent ile gerçek pazar verileriyle bağlanacak. Arayüz hazır; bağlantı bekleniyor."
        />
      </div>
    </div>
  );
}
