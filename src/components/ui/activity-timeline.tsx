import {
  ArrowRightLeft,
  CalendarClock,
  CircleDollarSign,
  MessageSquareText,
  PhoneCall,
  Sparkles,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
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
 */
function pickIcon(type: string, description: string): { Icon: LucideIcon; human: boolean } {
  if (type === "note") return { Icon: MessageSquareText, human: true };
  if (type === "call") return { Icon: PhoneCall, human: true };
  if (type === "meeting") return { Icon: Users, human: true };
  if (type === "status_change") return { Icon: ArrowRightLeft, human: false };

  if (/^Takip/i.test(description)) return { Icon: CalendarClock, human: false };
  if (/^Satış/i.test(description)) return { Icon: CircleDollarSign, human: false };
  if (/^Görüşen kişi/i.test(description)) return { Icon: UserRound, human: false };
  return { Icon: Sparkles, human: false };
}

export function ActivityTimeline({ items, emptyText }: { items: TimelineItem[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-600">{emptyText}</p>;
  }

  return (
    <ol className="flex flex-col gap-4">
      {items.map((item, index) => {
        const { Icon, human } = pickIcon(item.type, item.description);
        return (
          <li
            key={item.id}
            className="animate-slide-up flex gap-3 text-sm"
            style={{ animationDelay: `${Math.min(index, 8) * 8}ms` }}
          >
            <span
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                human ? "bg-accent-500/15 text-accent-400" : "bg-white/[0.06] text-ink-400"
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className={cn("whitespace-pre-wrap", human ? "text-ink-900" : "text-xs text-ink-600")}>
                {item.description}
              </p>
              <p className="mt-0.5 text-xs text-ink-600">{formatDateTime(item.created_at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
