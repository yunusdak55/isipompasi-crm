import { IntentLink as Link } from "@/components/ui/intent-link";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, getInitials } from "@/lib/utils";
import type { ChipTone, TaskItem } from "@/components/dashboard/view-model";

type SectionTone = "accent" | "danger" | "success";

/* Renkler yalniz tokenlardan (app/iklim.css): ikon kutusu, avatar, satir isigi. */
const TONE = {
  accent: { box: "t-accent", avatar: "text-[var(--accent-text)] border-[var(--accent-line)] bg-[linear-gradient(135deg,rgba(255,171,92,0.22),rgba(244,124,32,0.05))]", glow: "rgba(244,124,32,0.11)", bar: "var(--accent-hi)", card: "" },
  danger: { box: "t-danger", avatar: "text-[var(--danger)] border-[var(--danger-line)] bg-[var(--danger-bg)]", glow: "rgba(217,85,63,0.11)", bar: "var(--danger)", card: "tone-danger" },
  success: { box: "t-success", avatar: "text-[var(--ok)] border-[var(--ok-line)] bg-[var(--ok-bg)]", glow: "rgba(52,165,107,0.11)", bar: "var(--ok)", card: "tone-success" },
} satisfies Record<SectionTone, { box: string; avatar: string; glow: string; bar: string; card: string }>;

const DOT: Record<ChipTone, string> = {
  accent: "bg-[var(--accent)] shadow-[0_0_10px_rgba(244,124,32,0.75)]",
  warning: "bg-[var(--warn-solid)]",
  danger: "bg-[var(--danger-solid)]",
  success: "bg-[var(--ok-solid)]",
};

/** Tek musteri satiri. Satirin tamami tiklanabilir (gercek <a> kapsama tekniği). */
function TaskRow({ item, tone, agenda, index }: { item: TaskItem; tone: SectionTone; agenda: boolean; index: number }) {
  return (
    <li
      className={cn(
        "ik-row rise group relative flex items-center gap-3 px-4 py-3.5 sm:px-5",
        agenda && "first:[&_.rail]:top-1/2 last:[&_.rail]:bottom-1/2 only:[&_.rail]:hidden"
      )}
      // Satirlar kartin ardindan sirayla gelir; uzerine gelince soldan tonlu isik + ince cizgi (tek parca).
      style={{ "--i": 3 + Math.min(index, 8), "--row-glow": TONE[tone].glow, "--row-bar": TONE[tone].bar } as React.CSSProperties}
    >
      {agenda ? (
        <>
          <span className="w-11 shrink-0 text-right font-display text-sm font-semibold tabular-nums tracking-[-0.01em] text-[var(--text)]">{item.clock}</span>
          <span className="relative -my-3.5 flex w-4 shrink-0 items-center justify-center self-stretch" aria-hidden="true">
            <span className="rail absolute inset-y-0 w-px bg-[linear-gradient(180deg,rgba(143,211,255,0.06),rgba(143,211,255,0.24),rgba(255,171,92,0.1))]" />
            <span className={cn("relative z-10 h-3 w-3 rounded-full ring-4 ring-[var(--ring-cut)]", DOT[item.chip.tone])} />
          </span>
        </>
      ) : (
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-display text-xs font-semibold",
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
          className="block truncate text-sm font-semibold text-[var(--text)] after:absolute after:inset-0 after:content-['']"
        >
          {item.name}
        </Link>
        <p className="mt-0.5 truncate text-xs text-[var(--text-3)]">{item.sub}</p>
        {/* Dar ekranda durum rozeti sagda yer bulamaz - adin altina iner. */}
        <span
          className={cn(
            "ik-chip mt-1.5 px-2 py-0.5 text-[10px] sm:hidden",
            `t-${item.chip.tone}`
          )}
        >
          {item.chip.text}
        </span>
      </div>

      <span
        className={cn(
          "ik-chip hidden shrink-0 px-2.5 py-1 text-[11px] sm:inline-flex",
          `t-${item.chip.tone}`
        )}
      >
        {item.chip.text}
      </span>

      <ChevronRight
        className="h-4 w-4 shrink-0 text-[var(--text-4)] transition-[transform,color] duration-[260ms] ease-premium group-hover:translate-x-1 group-hover:text-[var(--accent-text)]"
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
  /** Listede gosterilmeyen kalan kayit sayisi. */
  remaining: number;
  emptyTitle: string;
  emptyBody: string;
  className?: string;
}) {
  return (
    <Card id={id} className={cn("scroll-mt-24 overflow-hidden", TONE[tone].card, className)}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line-soft)] px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("ik-ic-box", TONE[tone].box)}>{icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-display text-[15px] font-semibold tracking-[-0.01em] text-[var(--text)]">{title}</h2>
              <span className="ik-count tabular-nums">{count}</span>
            </div>
            {countLabel ? <p className="mt-0.5 text-[11.5px] text-[var(--text-3)]">{countLabel}</p> : null}
          </div>
        </div>
        <Link
          href={moreHref}
          className="group/more inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--text-3)] transition-colors duration-150 hover:bg-[var(--hover)] hover:text-[var(--text)]"
        >
          Tümünü gör
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover/more:translate-x-0.5" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-5 py-10 text-center">
          <span className="ik-ic-box t-success mb-2 !h-12 !w-12 !rounded-2xl shadow-[0_14px_30px_-16px_rgba(52,165,107,0.7)]">
            <Check className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <p className="font-display text-sm font-semibold text-[var(--text)]">{emptyTitle}</p>
          <p className="max-w-xs text-xs text-[var(--text-3)]">{emptyBody}</p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--line-soft)]">
          {items.map((item, index) => (
            <TaskRow key={item.id} item={item} tone={tone} agenda={agenda} index={index} />
          ))}
        </ul>
      )}

      {/* Bilerek link DEGIL: listenin tek girisi basliktaki "Tümünü gör". */}
      {remaining > 0 ? <p className="border-t border-[var(--line-soft)] px-5 py-3 text-center text-xs text-[var(--text-3)]">+ {remaining} kişi daha</p> : null}
    </Card>
  );
}
