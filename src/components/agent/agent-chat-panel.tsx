"use client";

import { useState } from "react";
import { Send, PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "system"; text: string };

/**
 * Ajan ile Sohbet / Rakip Analizi / Sektor Durumu ucu de AYNI premium chat
 * kabugunu paylasir (spec: "birbirinden kopuk 3 farkli tasarim gibi
 * gorunmemeli"). Gercek AI baglantisi henuz yok - gonderilen mesajdan sonra
 * SAHTE bir AI cevabi degil, durumu acikca belirten bir "baglanti bekleniyor"
 * yer tutucusu gosterilir (spec md.9/18: "veri uydurma").
 */
export function AgentChatPanel({
  title,
  description,
  introHeadline,
  introBody,
  suggestedQuestions,
  placeholder,
  connectionNote,
}: {
  title: string;
  description: string;
  introHeadline: string;
  introBody: string;
  suggestedQuestions: [string, string, string];
  placeholder: string;
  connectionNote: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  function handleChipClick(question: string) {
    setInput(question);
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setSending(true);

    // Gercek AI/n8n baglantisi ileride buraya eklenecek. Simdilik sadece UI -
    // kisa bir "yaziyor" animasyonunun ardindan durumu acikca belirten bir
    // yer tutucu mesaj gosterilir.
    window.setTimeout(() => {
      setMessages((prev) => [...prev, { role: "system", text: connectionNote }]);
      setSending(false);
    }, 700);
  }

  return (
    <div className="relative flex h-full min-h-[560px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-elevated-lg">
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-500/[0.08] blur-[110px]" />
        <div className="absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-brand-500/20 blur-[100px]" />
      </div>

      <div className="relative flex shrink-0 items-center gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-white/50">{description}</p>
        </div>
      </div>

      <div className="scrollbar-kanban relative flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-5">
        {messages.length === 0 ? (
          <div className="animate-fade-in flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div>
              <p className="text-base font-semibold text-white">{introHeadline}</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-white/50">{introBody}</p>
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={cn("animate-slide-up flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              {m.role === "user" ? (
                <p className="max-w-[80%] rounded-2xl rounded-br-md bg-accent-500 px-3.5 py-2.5 text-sm text-white shadow-sm">
                  {m.text}
                </p>
              ) : (
                <div className="flex max-w-[85%] flex-col gap-1.5 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.05] px-3.5 py-2.5">
                  <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">
                    <PlugZap className="h-2.5 w-2.5" />
                    Bağlantı bekleniyor
                  </span>
                  <p className="text-sm text-white/75">{m.text}</p>
                </div>
              )}
            </div>
          ))
        )}

        {sending ? (
          <div className="animate-fade-in flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.05] px-4 py-3">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/50 [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/50 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/50 [animation-delay:300ms]" />
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative flex shrink-0 flex-col gap-3 border-t border-white/10 px-5 py-4">
        <div className="flex flex-wrap gap-2">
          {suggestedQuestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => handleChipClick(q)}
              className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white/75 transition-all duration-150 ease-snappy hover:border-accent-400/40 hover:bg-accent-500/[0.10] hover:text-white active:scale-[0.97]"
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
            placeholder={placeholder}
            disabled={sending}
            className="flex-1 rounded-lg border border-white/15 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.09] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-flame-hot via-accent-500 to-flame-ember text-white shadow-glow-accent transition-all duration-150 ease-snappy hover:-translate-y-px hover:shadow-glow-accent-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-glow-accent"
          >
            <Send className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </form>
      </div>
    </div>
  );
}
