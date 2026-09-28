"use client";

import { useState } from "react";
import { Send, ShieldCheck } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

export type AgentDigest = {
  totalLeads: number;
  overdueCount: number;
  conversionRate: number;
  totalSaleAmount: number;
  avgOfferAmount: number;
  avgSaleAmount: number;
  cityDistribution: { label: string; count: number }[];
  productInterestDistribution: { label: string; count: number }[];
  funnel: { label: string; count: number }[];
  overdueLeads: { name: string; daysText: string }[];
};

type ChatMessage = { role: "user" | "agent"; text: string };

/**
 * Onceki 3 sayfanin (Ajan ile Sohbet / Rakip Analizi / Sektor Durumu) yerini
 * alan TEK "Dijital Ajan" bolumunun sohbet kutusu. Spec: "rakip analizi
 * sektor analizi falan kalksin, dijital ajan o tek kisimdan sirkete dair
 * bilgi versin". Onceki tasarimin "veri uydurma" ilkesi korunuyor - ama
 * artik gercekten CEVAP VEREBILIYOR: LLM baglantisi yok (API anahtari
 * gerektirir), bunun yerine sunucuda hesaplanmis GERCEK sirket verisi
 * uzerinde anahtar kelime eslestirmesiyle calisan, hicbir sayiyi uydurmayan
 * basit bir kural motoru. Bilmedigi bir soruda durumu acikca soyler.
 */
export function AgentInsightsChat({ digest }: { digest: AgentDigest }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");

  function answer(question: string): string {
    const q = question.toLocaleLowerCase("tr");

    if (/gecik|takip.*(bekle|kal)/.test(q)) {
      if (digest.overdueCount === 0) return "Şu anda gecikmiş takip yok — her şey güncel görünüyor.";
      const names = digest.overdueLeads
        .slice(0, 5)
        .map((l) => `${l.name} (${l.daysText})`)
        .join(", ");
      return `${digest.overdueCount} lead gecikmiş takip bekliyor. En öncelikli olanlar: ${names}.`;
    }

    if (/şehir|il\b|nere/.test(q)) {
      if (digest.cityDistribution.length === 0) return "Şehir bilgisi olan bir lead henüz yok.";
      const top = digest.cityDistribution
        .slice(0, 5)
        .map((c) => `${c.label} (${c.count})`)
        .join(", ");
      return `Lead'leriniz en çok şu şehirlerden geliyor: ${top}.`;
    }

    if (/hizmet|ürün|urun|ilgi/.test(q)) {
      if (digest.productInterestDistribution.length === 0) return "Hizmet/ürün bilgisi olan bir lead henüz yok.";
      const top = digest.productInterestDistribution
        .slice(0, 5)
        .map((c) => `${c.label} (${c.count})`)
        .join(", ");
      return `En çok ilgi gören hizmetler: ${top}.`;
    }

    if (/ciro|gelir|satış tutar|satis tutar/.test(q)) {
      return `Toplam ciro ${formatCurrency(digest.totalSaleAmount)}, ortalama satış tutarı ${formatCurrency(digest.avgSaleAmount)}.`;
    }

    if (/dönüşüm|donusum|conversion/.test(q)) {
      return `Lead → satış dönüşüm oranınız %${digest.conversionRate.toFixed(1)}.`;
    }

    if (/teklif/.test(q)) {
      return `Ortalama teklif tutarı ${formatCurrency(digest.avgOfferAmount)}.`;
    }

    if (/kaç lead|kac lead|toplam lead|kaç müşteri|kac musteri/.test(q)) {
      return `Şu anda toplam ${digest.totalLeads} lead yönetiyorsunuz.`;
    }

    if (/huni|pipeline|aşama|asama|durum dağılım/.test(q)) {
      const top = digest.funnel
        .filter((f) => f.count > 0)
        .map((f) => `${f.label}: ${f.count}`)
        .join(", ");
      return top ? `Pipeline dağılımınız — ${top}.` : "Henüz pipeline'da bir lead yok.";
    }

    return "Bu soruyu şu anki verilerle cevaplayamıyorum — size veri uydurmam. Gecikenler, şehir/hizmet dağılımı, ciro, dönüşüm oranı veya toplam lead sayısı hakkında sorabilirsiniz.";
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }, { role: "agent", text: answer(text) }]);
  }

  const suggestions = ["Gecikmiş takip var mı?", "Hangi şehirlerden lead geliyor?", "Dönüşüm oranım ne?"];

  return (
    <div className="relative flex h-full min-h-[420px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-elevated-lg">
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-500/[0.08] blur-[110px]" />
        <div className="absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-brand-500/20 blur-[100px]" />
      </div>

      <div className="relative flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-white">Ajana Sor</p>
          <p className="text-xs text-white/50">İşletmenizin gerçek verileri hakkında soru sorun.</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-500/15 px-2.5 py-1 text-[10px] font-medium text-success-300 ring-1 ring-inset ring-success-500/25">
          <ShieldCheck className="h-3 w-3" />
          Gerçek veri
        </span>
      </div>

      <div className="scrollbar-kanban relative flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-5">
        {messages.length === 0 ? (
          <div className="animate-fade-in flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div>
              <p className="text-base font-semibold text-white">Ne öğrenmek istersiniz?</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-white/50">
                Aşağıdaki örneklerden birini seçin veya kendi sorunuzu yazın.
              </p>
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={cn("animate-slide-up flex", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "user" ? (
                <p className="max-w-[80%] rounded-2xl rounded-br-md bg-accent-500 px-3.5 py-2.5 text-sm text-white shadow-sm">
                  {m.text}
                </p>
              ) : (
                <div className="flex max-w-[85%] flex-col gap-1.5 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.05] px-3.5 py-2.5">
                  <p className="text-sm text-white/85">{m.text}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="relative flex shrink-0 flex-col gap-3 border-t border-white/10 px-5 py-4">
        <div className="flex flex-wrap gap-2">
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setInput(q)}
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
            placeholder="İşletmeniz hakkında bir soru yazın…"
            className="flex-1 rounded-lg border border-white/15 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.09]"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-flame-hot via-accent-500 to-flame-ember text-white shadow-glow-accent transition-all duration-150 ease-snappy hover:-translate-y-px hover:shadow-glow-accent-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-glow-accent"
          >
            <Send className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </form>
      </div>
    </div>
  );
}
