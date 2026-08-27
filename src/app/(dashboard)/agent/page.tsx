import Link from "next/link";
import { Sparkles, MessageCircle, Compass, Radar, ArrowRight } from "lucide-react";
import { AgentFigure } from "@/components/agent/agent-figure";

const MODULES = [
  {
    href: "/agent/chat",
    title: "Ajan ile Sohbet",
    description: "Satış, müşteriler ve performansınız hakkında doğrudan soru sorun.",
    icon: MessageCircle,
  },
  {
    href: "/agent/competitors",
    title: "Rakip Analizi",
    description: "Rakiplerinizin kampanya ve konumlandırmalarını izleyin.",
    icon: Compass,
  },
  {
    href: "/agent/industry",
    title: "Sektör Durumu",
    description: "Isı pompası sektöründeki gelişmeleri ve talep hareketlerini takip edin.",
    icon: Radar,
  },
] as const;

export default function AgentOverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-7 shadow-elevated-lg sm:p-10">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -left-24 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-brand-500/25 blur-[120px]" />
          <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-accent-500/[0.14] blur-[120px]" />
        </div>

        <div className="relative flex flex-col items-center gap-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="sm:max-w-md">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-500/15 px-3 py-1 text-xs font-medium text-accent-300 ring-1 ring-inset ring-accent-500/25">
              <Sparkles className="h-3 w-3" />
              Dijital Ajan
            </span>
            <h1 className="mt-3.5 text-2xl font-semibold tracking-tight text-white sm:text-[28px]">
              İşletmeniz için 7/24 çalışan dijital ajan
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/55 sm:text-[15px]">
              Satış sürecinizi, rakiplerinizi ve sektörünüzü sizin için izleyen bir yapay zeka katmanı. Aşağıdaki
              modüllerden birini seçerek başlayın.
            </p>
          </div>

          <AgentFigure size={176} className="animate-scale-in" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {MODULES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group animate-slide-up relative flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm shadow-black/20 transition-all duration-200 ease-premium hover:-translate-y-0.5 hover:border-accent-400/40 hover:shadow-elevated"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400 ring-1 ring-inset ring-accent-500/25 transition-all duration-200 ease-premium group-hover:bg-accent-500 group-hover:text-white group-hover:shadow-glow-accent">
              <m.icon className="h-5 w-5" strokeWidth={2} />
            </span>
            <h3 className="mt-3.5 text-sm font-semibold text-ink-900">{m.title}</h3>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-ink-600">{m.description}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent-500 opacity-0 transition-all duration-150 ease-snappy group-hover:translate-x-0.5 group-hover:opacity-100">
              Aç
              <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
