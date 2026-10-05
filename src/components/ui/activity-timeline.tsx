import {
  ArrowRightLeft,
  CalendarClock,
  HandCoins,
  MessageSquareText,
  PhoneCall,
  Sparkles,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { SALE_NOTE_PREFIX } from "@/lib/constants/lead";
import { cn, formatDateTime } from "@/lib/utils";

export type TimelineItem = {
  id: string;
  type: string;
  description: string;
  created_at: string;
};

/**
 * ZAMAN CIZELGESI - firma panelindeki lead detayinda ve ajans admin
 * panelindeki aday detayinda AYNI bilesen. Eski sade gorunume donuldu (spec
 * 2026-10-02: "karisiklasmis, eski hali gibi basit olsun, ama daha guzel
 * ikonlar"): etiket/sayac/kutu yok - her satir tek ikon + metin + tarih.
 * "Görüşmede ne oldu" notlari belirgin metin + vurgulu ikon, otomatik
 * (sistem) satirlar soluk ve kucuk yazilir; ikon icerige gore secilir.
 *
 * SATIS (spec 2026-10-05: "satış yapılınca zaman çizelgesine eklensin, satış
 * ikonuyla gelsin, yanında aldığım not gözüksün"): satis satiri eskiden soluk bir
 * sistem satiriydi ve fark edilmiyordu. Artik satisin kendisi ve satis notu yesil
 * satis ikonuyla, belirgin yazilir.
 */
type Kind = "human" | "auto" | "sale" | "saleNote";

function classify(type: string, description: string): { Icon: LucideIcon; kind: Kind } {
  if (description.startsWith(SALE_NOTE_PREFIX)) return { Icon: HandCoins, kind: "saleNote" };
  if (type === "note") return { Icon: MessageSquareText, kind: "human" };
  if (type === "call") return { Icon: PhoneCall, kind: "human" };
  if (type === "meeting") return { Icon: Users, kind: "human" };
  if (type === "status_change") return { Icon: ArrowRightLeft, kind: "auto" };

  if (/^Takip/i.test(description)) return { Icon: CalendarClock, kind: "auto" };
  // "Satış yapıldı: ₺…" / "Satış tutarı güncellendi: ₺…" (eski kayitlarda "Satış tutarı kaydedildi: ₺…").
  if (/^Satış/i.test(description)) return { Icon: HandCoins, kind: "sale" };
  if (/^Görüşen kişi/i.test(description)) return { Icon: UserRound, kind: "auto" };
  return { Icon: Sparkles, kind: "auto" };
}

const ICON_TONE: Record<Kind, string> = {
  human: "bg-accent-500/15 text-accent-400",
  auto: "bg-white/[0.06] text-ink-400",
  sale: "bg-success-500/20 text-[#8ef0b8] ring-1 ring-inset ring-success-500/40",
  saleNote: "bg-success-500/20 text-[#8ef0b8] ring-1 ring-inset ring-success-500/40",
};

function Body({ kind, description }: { kind: Kind; description: string }) {
  if (kind === "sale") {
    // "Satış yapıldı: ₺425.000" -> baslik + tutar rozeti. Eski "…kaydedildi" metni de satis sayilir.
    const [rawLabel, ...rest] = description.split(": ");
    const amount = rest.join(": ");
    const label = rawLabel === "Satış tutarı kaydedildi" ? "Satış yapıldı" : rawLabel;
    return (
      <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-900">
        {label}
        {amount ? (
          <span className="rounded-full bg-success-500/15 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-[#8ef0b8] ring-1 ring-inset ring-success-500/30">
            {amount}
          </span>
        ) : null}
      </p>
    );
  }
  if (kind === "saleNote") {
    return (
      <>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#7ee2ad]">Satış notu</p>
        <p className="mt-0.5 whitespace-pre-wrap text-ink-900">{description.slice(SALE_NOTE_PREFIX.length)}</p>
      </>
    );
  }
  return <p className={cn("whitespace-pre-wrap", kind === "human" ? "text-ink-900" : "text-xs text-ink-600")}>{description}</p>;
}

export function ActivityTimeline({ items, emptyText }: { items: TimelineItem[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-600">{emptyText}</p>;
  }

  return (
    <ol className="flex flex-col gap-4">
      {items.map((item, index) => {
        const { Icon, kind } = classify(item.type, item.description);
        return (
          <li
            key={item.id}
            className="animate-slide-up flex gap-3 text-sm"
            style={{ animationDelay: `${Math.min(index, 8) * 8}ms` }}
          >
            <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", ICON_TONE[kind])}>
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <Body kind={kind} description={item.description} />
              <p className="mt-0.5 text-xs text-ink-600">{formatDateTime(item.created_at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
