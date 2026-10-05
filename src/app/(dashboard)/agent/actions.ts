"use server";

import { requireProfile } from "@/lib/auth/session";
import { getAgentDigest, buildAgentInsights } from "@/lib/data/agent-digest";
import { formatCurrency, formatRate } from "@/lib/utils";

export type AgentChatTurn = { role: "user" | "agent"; text: string };

/**
 * Model talimata ragmen zaman zaman markdown vurgusu (**kalin**, __x__, `kod`,
 * # baslik) uretiyor; sohbet arayuzu duz metin gosterdigi icin bunlar
 * "**" olarak ekrana cikiyordu (bildirim, spec 2026-10-02). Listeler (1. / -)
 * duz metin olarak okunabilir oldugu icin korunur.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/__([\s\S]+?)__/g, "$1")
    .replace(/`{1,3}([^`]*)`{1,3}/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "");
}

/**
 * Dijital Ajan'in gercek LLM baglantisi (spec 2026-09-28: "ben mevcut
 * aldigimiz tokeni ona baglarim o da cevaplar"). Bilerek n8n'deki WhatsApp
 * agent'inin AYNI mantigini tasiyor: hicbir sayi UYDURULMAZ, model SADECE
 * asagida verilen gercek veri digest'i uzerinden konusur. API anahtari
 * henuz .env.local'e eklenmediyse (kullanici "baglarim" dedi, henuz
 * eklemedi) durum acikca soylenir - sahte bir cevap ASLA uretilmez.
 *
 * Neden Server Action (Route Handler degil): bu projede hic `src/app/api`
 * yok, TUM client->server cagrilari "use server" fonksiyonlariyla yapiliyor
 * (bkz. leads/actions.ts -> searchLeadSuggestionsAction, ayni desen).
 */
export async function askAgentAction(message: string, history: AgentChatTurn[]): Promise<{ reply: string }> {
  const profile = await requireProfile();
  const trimmed = message.trim().slice(0, 2000);
  if (!trimmed) return { reply: "Bir soru yazmadınız." };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      reply:
        "AI bağlantısı henüz kurulmadı — .env.local dosyasına OPENAI_API_KEY eklendiğinde bu soruları gerçek yapay zeka ile cevaplayacağım. Şu an sadece üstteki hazır analizleri gösterebiliyorum.",
    };
  }

  const digest = await getAgentDigest();
  const insights = buildAgentInsights(digest);

  const dataBlock = [
    `Firma: ${profile.company?.name ?? "Bilinmiyor"}`,
    `Toplam lead: ${digest.totalLeads}`,
    `Gecikmiş takip (takibe alınmış ve takip tarihi 24 saatten fazla geçmiş müşteri sayısı): ${digest.overdueCount}`,
    `Dönüşüm oranı: ${formatRate(digest.conversionRate)}`,
    `Pipeline değeri: ${formatCurrency(digest.pipelineValue)}`,
    digest.hasAnySale ? `Toplam ciro: ${formatCurrency(digest.totalRevenue)}, ortalama satış: ${formatCurrency(digest.avgSaleValue)}` : "Henüz kayıtlı satış yok.",
    `Ortalama teklif: ${formatCurrency(digest.avgOfferAmount)}`,
    digest.monthComparison
      ? `Ay karşılaştırması: ${digest.monthComparison.thisMonthLabel} ayında ${digest.monthComparison.leadCountThis} lead / ${digest.monthComparison.wonCountThis} satış / ${formatCurrency(digest.monthComparison.revenueThis)} ciro; ${digest.monthComparison.lastMonthLabel} ayında ${digest.monthComparison.leadCountLast} lead / ${digest.monthComparison.wonCountLast} satış / ${formatCurrency(digest.monthComparison.revenueLast)} ciro vardı.`
      : null,
    `Pipeline dağılımı: ${digest.funnel.map((f) => `${f.label}=${f.count}`).join(", ")}`,
    digest.cityDistribution.length ? `Şehir dağılımı: ${digest.cityDistribution.map((c) => `${c.label}=${c.count}`).join(", ")}` : null,
    digest.productInterestDistribution.length
      ? `Hizmet ilgi dağılımı: ${digest.productInterestDistribution.map((c) => `${c.label}=${c.count}`).join(", ")}`
      : null,
    digest.bySalesperson.length
      ? `Satış temsilcisi performansı: ${digest.bySalesperson.map((s) => `${s.name}: ${s.count} lead, ${formatCurrency(s.revenue)} ciro`).join(" | ")}`
      : null,
    digest.overdueLeads.length
      ? `Gecikmiş lead'ler: ${digest.overdueLeads.map((l) => `${l.name} (${l.city ?? "şehir yok"}, ${l.daysText})`).join(", ")}`
      : null,
    `Sistemin kendi tespit ettiği uyarılar: ${insights.map((i) => i.text).join(" ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = [
    "Sen bir iklimlendirme/ısı pompası CRM'i içinde çalışan, deneyimli bir satış ve iş performansı danışmanısın.",
    "Görevin: aşağıda verilen GERÇEK işletme verisini kullanarak işletme sahibine nerede hata yapıldığını, nerenin iyi gittiğini ve para kazanmak için nereye odaklanması gerektiğini net, somut ve eyleme dönük şekilde anlatmak.",
    "KURALLAR:",
    "- SADECE aşağıda verilen veriyi kullan. Verilmeyen hiçbir sayıyı, ismi veya istatistiği ASLA uydurma.",
    "- Veri bir soruyu cevaplamaya yetmiyorsa bunu açıkça söyle, tahmin yürütme.",
    "- Türkçe, kısa, net, samimi ama profesyonel bir dille yaz. Gereksiz giriş cümleleri kurma, doğrudan konuya gir.",
    "- Mümkün olduğunda somut bir aksiyon öner (kime dönülmeli, hangi aşama önceliklendirilmeli).",
    "- \"Gecikmiş\" kelimesini YALNIZCA takibe alınmış ve takip tarihinin üzerinden 24 saatten fazla geçmiş müşteriler için kullan; bunlar verideki \"Gecikmiş takip\" sayısı ve listesindekilerdir. Takibe alınmamış veya takip tarihi 24 saatten az geçmiş hiçbir müşteriye gecikmiş deme.",
    "- Düz metin yaz: markdown KULLANMA. Çift yıldız (**), alt çizgiyle vurgu, # başlık, ``` kod bloğu veya tablo kullanma. Vurguyu kelimelerle yap; liste gerekiyorsa her satırı \"1.\" ya da \"-\" ile başlat.",
    "- Fiyat/indirim önerme, satış kapatma taktiği verme — bunlar insan satış ekibinin işi, sen sadece analiz ve önceliklendirme yapıyorsun.",
    "",
    "GERÇEK VERİ:",
    dataBlock,
  ].join("\n");

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-8).map((h) => ({ role: h.role === "user" ? "user" : "assistant", content: h.text })),
    { role: "user", content: trimmed },
  ];

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      // Zaman asimi: OpenAI askida kalirsa server action (ve istemcideki sirali
      // action kuyrugu) sonsuza kadar beklemesin - 30 sn'de catch'e duser.
      signal: AbortSignal.timeout(30_000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
        messages,
        // gpt-5.x ailesi `max_tokens` ve ozel `temperature` degerlerini REDDEDER
        // (canli testte HTTP 400 alindi) - `max_completion_tokens` kullanilir,
        // sicaklik varsayilanda birakilir.
        max_completion_tokens: 900,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("askAgentAction OpenAI error:", res.status, errText.slice(0, 300));
      return { reply: "Yapay zeka şu anda cevap veremedi (bağlantı hatası). Birazdan tekrar deneyin." };
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = stripMarkdown(json.choices?.[0]?.message?.content ?? "").trim();
    return { reply: reply || "Bir cevap üretemedim, lütfen soruyu farklı şekilde tekrar sorun." };
  } catch (err) {
    console.error("askAgentAction fetch error:", err);
    return { reply: "Yapay zekaya ulaşırken bir sorun oluştu. Birazdan tekrar deneyin." };
  }
}
