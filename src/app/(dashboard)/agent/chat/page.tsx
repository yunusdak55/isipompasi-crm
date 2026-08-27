import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AgentChatPanel } from "@/components/agent/agent-chat-panel";

export default function AgentChatPage() {
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
          title="Ajan ile Sohbet"
          description="Satış, müşteriler ve performansınız hakkında soru sorun."
          introHeadline="Nasıl yardımcı olabilirim?"
          introBody="Satış, müşteriler ve performansınız hakkında soru sorun."
          suggestedQuestions={[
            "Şu anda en çok ilgilenmem gereken müşteriler hangileri?",
            "Bu ay satışlar neden düştü?",
            "Şu anda satış sürecinde kaçırdığım fırsatlar var mı?",
          ]}
          placeholder="Bir soru yazın…"
          connectionNote="Ajan ile Sohbet yakında canlı yapay zeka bağlantısıyla aktif olacak. Arayüz hazır; gerçek yanıt üretimi bağlanmayı bekliyor."
        />
      </div>
    </div>
  );
}
