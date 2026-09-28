"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Send, ShieldCheck, AlertTriangle, TriangleAlert, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentFigure } from "@/components/agent/agent-figure";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";
import { askAgentAction, type AgentChatTurn } from "@/app/(dashboard)/agent/actions";
import type { AgentInsight } from "@/lib/data/agent-digest";

type ChatMessage = { role: "user" | "agent"; text: string; tone?: AgentInsight["tone"] };

const TONE_ICON: Record<AgentInsight["tone"], typeof AlertTriangle> = {
  danger: TriangleAlert,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
};

const TONE_CLASSES: Record<AgentInsight["tone"], string> = {
  danger: "border-danger-500/30 bg-danger-500/[0.08] text-danger-200",
  warning: "border-warning-500/30 bg-warning-500/[0.08] text-warning-200",
  success: "border-success-500/30 bg-success-500/[0.08] text-success-200",
  info: "border-accent-500/30 bg-accent-500/[0.08] text-accent-200",
};

/**
 * Dijital Ajan'in TEK bolumu (spec 2026-09-28/30). GORSEL REVIZYON
 * (2026-09-30, "göz çok alan kaplıyor, chat kısmını büyüt, arka plan boş
 * duruyor, en üst düzey grafik seviyesine getir"):
 *  - Buyuk, sayfanin ustunu kaplayan gozu KALDIRDIK - artik basligin
 *    icinde KUCUK bir avatar rozeti (AgentFigure kucuk boyutta). Mesaj
 *    alani artik panelin neredeyse tamamini kapliyor.
 *  - Arka plan artik uygulamanin diger "giris" (hero) panelleriyle AYNI
 *    canli HVAC boru/vana dokusu (`HvacBackdrop`, zaten var olan, performansli
 *    bir bilesen - sadece CSS animasyonu, ekstra JS/agirlik YOK). Bos
 *    hissettiren duz koyu zemin yerine markanin geri kalaniyla tutarli,
 *    hareketli bir zemin.
 */
export function AgentChat({ insights, companyName }: { insights: AgentInsight[]; companyName: string | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    insights.map((i) => ({ role: "agent", text: i.text, tone: i.tone }))
  );
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isPending]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isPending) return;
    const history: AgentChatTurn[] = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    startTransition(async () => {
      const { reply } = await askAgentAction(trimmed, history);
      setMessages((prev) => [...prev, { role: "agent", text: reply }]);
    });
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  const suggestions = ["Nerede hata yapıyorum?", "Bu ay neye odaklanmalıyım?", "Satışlarımı nasıl artırırım?"];

  return (
    <div className="relative flex h-full min-h-[75vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-brand-950 shadow-elevated-lg">
      <HvacBackdrop intensity="hero" className="opacity-90" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-950/10 via-brand-950/55 to-brand-950/90" aria-hidden />

      <div className="relative flex shrink-0 items-center gap-3 border-b border-white/10 bg-black/10 px-5 py-4 backdrop-blur-sm">
        <AgentFigure size={66} state={isPending ? "thinking" : "idle"} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {companyName ? `${companyName} için buradayım` : "Dijital Ajanınız"}
          </p>
          <p className="truncate text-xs text-white/50">İşletmenizin gerçek verileriyle konuşuyorum.</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-500/15 px-2.5 py-1 text-[10px] font-medium text-success-300 ring-1 ring-inset ring-success-500/25">
          <ShieldCheck className="h-3 w-3" />
          Gerçek veri
        </span>
      </div>

      <div ref={scrollRef} className="scrollbar-kanban relative flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-5">
        {messages.map((m, i) => {
          if (m.role === "agent" && m.tone) {
            const Icon = TONE_ICON[m.tone];
            return (
              <div
                key={i}
                className={cn(
                  "animate-slide-up flex items-start gap-2.5 rounded-2xl border px-3.5 py-2.5",
                  TONE_CLASSES[m.tone]
                )}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />
                <p className="text-sm leading-relaxed">{m.text}</p>
              </div>
            );
          }
          return (
            <div key={i} className={cn("animate-slide-up flex", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "user" ? (
                <p className="max-w-[80%] rounded-2xl rounded-br-md bg-accent-500 px-3.5 py-2.5 text-sm text-white shadow-sm">
                  {m.text}
                </p>
              ) : (
                <div className="flex max-w-[85%] flex-col gap-1.5 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.06] px-3.5 py-2.5 backdrop-blur-sm">
                  <p className="whitespace-pre-line text-sm text-white/85">{m.text}</p>
                </div>
              )}
            </div>
          );
        })}

        {isPending ? (
          <div className="animate-fade-in flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/50 [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/50 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/50 [animation-delay:300ms]" />
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative flex shrink-0 flex-col gap-3 border-t border-white/10 bg-black/10 px-5 py-4 backdrop-blur-sm">
        <div className="flex flex-wrap gap-2">
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              disabled={isPending}
              className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white/75 transition-all duration-150 ease-snappy hover:border-accent-400/40 hover:bg-accent-500/[0.10] hover:text-white active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>

        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="İşletmeniz hakkında bir soru yazın…"
            disabled={isPending}
            className="flex-1 rounded-lg border border-white/15 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.09] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isPending || !input.trim()}
            className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-flame-hot via-accent-500 to-flame-ember text-white shadow-glow-accent transition-all duration-150 ease-snappy hover:-translate-y-px hover:shadow-glow-accent-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-glow-accent"
          >
            <Send className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </form>
      </div>
    </div>
  );
}
