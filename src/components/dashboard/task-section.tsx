import Link from "next/link";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, getInitials } from "@/lib/utils";
import type { ChipTone, TaskItem } from "@/components/dashboard/view-model";

type SectionTone = "accent" | "danger" | "success";

const TONE = {
  accent: {
    icon: "bg-accent-500/20 text-accent-300 ring-accent-500/30 shadow-[0_0_20px_-4px_rgba(244,124,32,0.55)]",
    avatar: "from-accent-500/30 to-accent-500/10 text-accent-200 ring-accent-500/25",
    bar: "before:bg-accent-500",
    header: "from-accent-500/[0.08]",
  },
  danger: {
    icon: "bg-danger-500/20 text-[#ffc2b4] ring-danger-500/30 shadow-[0_0_20px_-4px_rgba(196,67,46,0.6)]",
    avatar: "from-danger-500/30 to-danger-500/10 text-[#ffc2b4] ring-danger-500/25",
    bar: "before:bg-danger-500",
    header: "from-danger-500/[0.08]",
  },
  success: {
    icon: "bg-success-500/20 text-[#9af0c3] ring-success-500/30 shadow-[0_0_20px_-4px_rgba(47,133,88,0.6)]",
    avatar: "from-success-500/30 to-success-500/10 text-[#9af0c3] ring-success-500/25",
    bar: "before:bg-success-500",
    header: "from-success-500/[0.08]",
  },
} satisfies Record<SectionTone, { icon: string; avatar: string; bar: string; header: string }>;

const CHIP: Record<ChipTone, string> = {
  accent: "bg-accent-500/15 text-accent-200 ring-accent-500/30",
  warning: "bg-warning-500/15 text-[#f5d98a] ring-warning-500/30",
  danger: "bg-danger-500/15 text-[#ffc2b4] ring-danger-500/30",
  success: "bg-success-500/15 text-[#9af0c3] ring-success-500/30",
};

const DOT: Record<ChipTone, string> = {
  accent: "bg-accent-500 shadow-[0_0_10px_rgba(244,124,32,0.7)]",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
  success: "bg-success-500",
};

/** Tek musteri satiri. Satirin tamami tiklanabilir (gercek <a> kapsama tekniği). */
function TaskRow({ item, tone, agenda, index }: { item: TaskItem; tone: SectionTone; agenda: boolean; index: number }) {
  return (
    <li
      className={cn(
        "animate-slide-up group relative flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-white/[0.045] sm:px-5",
        // Sol kenarda hover'da beliren ince vurgu cizgisi.
        "before:absolute before:inset-y-2.5 before:left-0 before:w-[3px] before:origin-center before:scale-y-0 before:rounded-r-full before:transition-transform before:duration-200 group-hover:before:scale-y-100 hover:before:scale-y-100",
        TONE[tone].bar,
        agenda && "first:[&_.rail]:top-1/2 last:[&_.rail]:bottom-1/2 only:[&_.rail]:hidden"
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
    >
      {agenda ? (
        <>
          <span className="w-11 shrink-0 text-right text-sm font-semibold tabular-nums text-ink-900">{item.clock}</span>
          <span className="relative -my-3.5 flex w-4 shrink-0 items-center justify-center self-stretch" aria-hidden="true">
            <span className="rail absolute inset-y-0 w-px bg-gradient-to-b from-white/5 via-white/20 to-white/5" />
            <span className={cn("relative z-10 h-3 w-3 rounded-full ring-4 ring-surface", DOT[item.chip.tone])} />
          </span>
        </>
      ) : (
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold ring-1 ring-inset",
            TONE[tone].avatar
          )}
          aria-hidden="true"
        >
          {getInitials(item.name)}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <Link
          href={item.href}
          className="block truncate text-sm font-semibold text-ink-900 transition-colors duration-150 after:absolute after:inset-0 after:content-[''] group-hover:text-white"
        >
          {item.name}
        </Link>
        <p className="mt-0.5 truncate text-xs text-ink-400">{item.sub}</p>
        {/* Dar ekranda durum rozeti sagda yer bulamaz - adin altina iner. */}
        <span
          className={cn(
            "mt-1.5 inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset sm:hidden",
            CHIP[item.chip.tone]
          )}
        >
          {item.chip.text}
        </span>
      </div>

      <span
        className={cn(
          "hidden shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset sm:inline-flex",
          CHIP[item.chip.tone]
        )}
      >
        {item.chip.text}
      </span>

      <ChevronRight
        className="h-4 w-4 shrink-0 text-white/20 transition-all duration-200 ease-premium group-hover:translate-x-0.5 group-hover:text-white/70"
        aria-hidden="true"
      />
    </li>
  );
}

/**
 * "Bugun" ekraninin gorev listesi karti: baslik + sayi + liste. agenda=true:
 * sol saat kolonu + dikey ray (gunun programi); false: avatarli duz liste.
 * Durum rozeti genis ekranda sagda, dar ekranda adin altinda durur.
 */
export function TaskSection({
  id,
  title,
  icon,
  tone,
  count,
  countLabel,
  items,
  agenda = false,
  moreHref,
  moreLabel,
  remaining,
  emptyTitle,
  emptyBody,
  className,
}: {
  id?: string;
  title: string;
  icon: React.ReactNode;
  tone: SectionTone;
  count: number;
  /** Basligin yanindaki kucuk aciklama ("en az geciken önce"). */
  countLabel?: string | null;
  items: TaskItem[];
  agenda?: boolean;
  moreHref: string;
  moreLabel: string;
  /** Listede gosterilmeyen kalan kayit sayisi. */
  remaining: number;
  emptyTitle: string;
  emptyBody: string;
  className?: string;
}) {
  return (
    <Card id={id} className={cn("scroll-mt-24 overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]", className)}>
      <div className={cn("flex items-center justify-between gap-3 border-b border-line bg-gradient-to-r to-transparent px-4 py-3.5 sm:px-5", TONE[tone].header)}>
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset", TONE[tone].icon)}>{icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-ink-900">{title}</h2>
              <span className="rounded-full bg-white/[0.09] px-2 py-0.5 text-xs font-semibold tabular-nums text-white/80">{count}</span>
            </div>
            {countLabel ? <p className="mt-0.5 text-[11px] text-ink-400">{countLabel}</p> : null}
          </div>
        </div>
        <Link
          href={moreHref}
          className="group/more inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-400 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white"
        >
          Tümünü gör
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover/more:translate-x-0.5" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-5 py-10 text-center">
          <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-success-500/15 text-[#9af0c3] ring-1 ring-inset ring-success-500/25 shadow-[0_0_24px_-6px_rgba(47,133,88,0.7)]">
            <Check className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <p className="text-sm font-semibold text-ink-900">{emptyTitle}</p>
          <p className="max-w-xs text-xs text-ink-400">{emptyBody}</p>
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {items.map((item, index) => (
            <TaskRow key={item.id} item={item} tone={tone} agenda={agenda} index={index} />
          ))}
        </ul>
      )}

      {remaining > 0 ? (
        <Link
          href={moreHref}
          className="block border-t border-line px-5 py-3 text-center text-xs font-medium text-ink-400 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white"
        >
          + {remaining} kişi daha · {moreLabel}
        </Link>
      ) : null}
    </Card>
  );
}
