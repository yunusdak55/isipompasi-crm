import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AgentChatPanel } from "@/components/agent/agent-chat-panel";

export default function AgentIndustryPage() {
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
          title="Sektör Durumu"
          description="Isı pompası sektöründeki gelişmeleri ve talep hareketlerini takip edin."
          introHeadline="Sektörü sizin için izliyorum."
          introBody="Sektör verileri bağlandığında burada özetlenecek - şimdilik bir soru sorabilirsiniz."
          suggestedQuestions={[
            "Isı pompası sektöründe şu anda öne çıkan gelişmeler neler?",
            "Türkiye'de ısı pompası talebinde şu anda nasıl bir hareket var?",
            "Önümüzdeki dönemde ısı pompası sektöründe hangi fırsatlar öne çıkabilir?",
          ]}
          placeholder="Sektör hakkında bir soru yazın…"
          connectionNote="Sektör Durumu ileride gerçek pazar verileriyle bağlanacak. Arayüz hazır; bağlantı bekleniyor."
        />
      </div>
    </div>
  );
}
