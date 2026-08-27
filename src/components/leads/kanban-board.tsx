"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { updateLeadStatusAction, upsertSaleAction } from "@/app/(dashboard)/leads/actions";
import { LEAD_STATUS_ORDER, LEAD_STATUS_LABELS } from "@/lib/constants/lead";
import { Button } from "@/components/ui/button";
import { NewLeadBadge, OverdueBadge } from "@/components/leads/lead-indicators";
import { cn, formatCurrency, isLeadNew, isLeadOverdue } from "@/lib/utils";
import type { BoardLead } from "@/lib/data/leads";
import type { LeadStatus } from "@/lib/types/domain";

type BoardState = Record<LeadStatus, BoardLead[]>;

// Kanban'a ozgu surukleme ayari: DROP ANINDA VE NET hissettirmeli - kullanici
// "hala animasyon bitmesini bekliyorum" hissine kapilmamali. Sadece kartin
// komsu pozisyona kaymasini yumusatacak KISA bir settle (~120ms) yeterli;
// uzun bir "settle" suresi burada YAVAS/agir hissi yaratir (kacinilmasi
// istenen his budur).
const DROP_TRANSITION = { duration: 120, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };

function findContainer(board: BoardState, id: string): LeadStatus | undefined {
  if ((LEAD_STATUS_ORDER as string[]).includes(id)) return id as LeadStatus;
  return LEAD_STATUS_ORDER.find((status) => board[status].some((lead) => lead.id === id));
}

type Density = "normal" | "compact";

// Adaptif yoğunluk: kolon başına lead sayısı arttıkça kartlar kaba bir
// "sürekli küçültme" yerine İKİ ayrı, kontrollü tipografi/spacing kademesi
// arasında geçiş yapar (spec: "gerektiğinde kontrollü şekilde küçülmeli").
// Eşiğin üstünde bile okunabilirlik bozulursa güvenlik ağı kolon içi
// dikey scroll'dur (bkz. Column) - kartlar asla ekranı taşırmaz.
const DENSITY_THRESHOLD = 8;

function KanbanCard({
  lead,
  status,
  density,
  onQuickMove,
}: {
  lead: BoardLead;
  status: LeadStatus;
  density: Density;
  onQuickMove: (leadId: string, from: LeadStatus, to: LeadStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    transition: DROP_TRANSITION,
  });

  const showNew = isLeadNew(lead.status);
  const showOverdue = isLeadOverdue({
    status: lead.status,
    lastContactAt: lead.last_contact_at,
    createdAt: lead.created_at,
    nextFollowupAt: lead.next_followup_at,
  });
  const compact = density === "compact";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        "flex touch-none cursor-grab flex-col rounded-lg border border-white/10 bg-white/[0.06] shadow-sm transition-shadow duration-150 ease-snappy hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.09] active:cursor-grabbing",
        compact ? "gap-1 p-2 text-[13px]" : "gap-2 p-3 text-sm",
        isDragging && "opacity-0"
      )}
    >
      <div className="flex items-center gap-1.5">
        {showOverdue ? <OverdueBadge className={compact ? "px-1.5 py-0.5 text-[9px]" : undefined} /> : null}
        <Link href={`/leads/${lead.id}`} className="truncate font-medium text-white transition-colors hover:text-accent-300">
          {lead.first_name} {lead.last_name ?? ""}
        </Link>
      </div>
      {showNew ? <NewLeadBadge className={cn("w-fit", compact && "px-1.5 py-0.5 text-[9px]")} /> : null}
      <p className={cn("truncate text-white/55", compact ? "text-[11px]" : "text-xs")}>
        {lead.phone}
        {lead.city ? ` · ${lead.city}` : ""}
      </p>
      {lead.offered_amount ? (
        <p className={cn("font-medium tabular-nums text-white/85", compact ? "text-[11px]" : "text-xs")}>
          {formatCurrency(lead.offered_amount)}
        </p>
      ) : null}
      <p className={cn("truncate text-white/55", compact ? "text-[11px]" : "text-xs")}>
        {lead.assigned_profile?.full_name ?? "Atanmadı"}
      </p>
      <select
        aria-label="Durumu taşı"
        value=""
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const to = e.target.value as LeadStatus;
          if (to) onQuickMove(lead.id, status, to);
        }}
        className={cn(
          "w-full rounded-md border border-white/15 bg-white/[0.08] text-white/75 transition-colors duration-150 focus-visible:border-accent-400 [&>option]:text-[#111827]",
          compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
        )}
      >
        <option value="">Taşı…</option>
        {LEAD_STATUS_ORDER.filter((s) => s !== status).map((s) => (
          <option key={s} value={s}>
            {LEAD_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Kart surukleniyorken imleci takip eden "kaldirilmis" gorsel (DragOverlay). */
function CardPreview({ lead }: { lead: BoardLead }) {
  return (
    <div className="animate-scale-in flex w-64 origin-center scale-[1.045] cursor-grabbing flex-col gap-2 rounded-lg border border-accent-200 bg-surface p-3 text-sm shadow-glow-accent-lg ring-2 ring-accent-500/15">
      <p className="truncate font-medium text-ink-900">
        {lead.first_name} {lead.last_name ?? ""}
      </p>
      <p className="truncate text-xs text-ink-600">
        {lead.phone}
        {lead.city ? ` · ${lead.city}` : ""}
      </p>
      <p className="truncate text-xs text-ink-600">{lead.assigned_profile?.full_name ?? "Atanmadı"}</p>
    </div>
  );
}

function Column({
  status,
  count,
  density,
  children,
}: {
  status: LeadStatus;
  count: number;
  density: Density;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full w-64 shrink-0 flex-col rounded-xl border border-white/10 bg-white/[0.03] p-2.5 transition-all duration-150 ease-snappy",
        isOver && "border-accent-400/50 bg-accent-500/[0.08] shadow-glow-accent ring-1 ring-inset ring-accent-400/30"
      )}
    >
      <div className="flex shrink-0 items-center justify-between px-1 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/50">{LEAD_STATUS_LABELS[status]}</span>
        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white/60">
          {count}
        </span>
      </div>
      {/* Kolon icerigi kendi ekseninde scroll olur - kart sayisi ne olursa
          olsun sutunlar arasi hizalanma bozulmaz, board ekrani tasmaz. */}
      <div
        className={cn(
          "scrollbar-kanban flex min-h-0 flex-1 flex-col overflow-y-auto pr-0.5",
          density === "compact" ? "gap-1.5" : "gap-2"
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** "Satış" kolonuna sürüklenen/taşınan lead için tutar isteyen kısa modal. */
function SaleAmountModal({
  leadName,
  onConfirm,
  onCancel,
}: {
  leadName: string;
  onConfirm: (amount: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsPending(true);
    setError(null);
    const err = await onConfirm(amount);
    setIsPending(false);
    if (err) setError(err);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-elevated-lg"
      >
        <h3 className="text-sm font-semibold text-ink-900">Satış Tutarı</h3>
        <p className="mt-1 text-xs text-ink-600">
          {leadName || "Bu lead"} için satış tutarını girin — girince &quot;Satış&quot; durumuna bu tutarla taşınır.
        </p>
        <input
          type="number"
          min="0"
          step="1"
          required
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="ör. 425000"
          className="mt-3 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition-colors duration-150 focus-visible:border-accent-400"
        />
        {error ? (
          <p role="alert" className="mt-2 text-xs text-[#ffb4a3]">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
            Vazgeç
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Kaydediliyor…" : "Kaydet ve Taşı"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function KanbanBoard({
  initialLeadsByStatus,
  canRecordSale,
}: {
  initialLeadsByStatus: BoardState;
  canRecordSale: boolean;
}) {
  const [board, setBoard] = useState<BoardState>(initialLeadsByStatus);
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragStartStatus = useRef<LeadStatus | null>(null);
  // "Satış"a taşınırken tutar isteyen modal - hem surukle-birak hem "Taşı…"
  // dropdown'u ayni akisi kullanir (spec: "satışa sürüklediğimizde satış
  // miktarını soracak bi kutucuk gelsin, onu girince oraya yerleştirilsin").
  const [saleModal, setSaleModal] = useState<{ leadId: string; from: LeadStatus; name: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeLead = activeId ? LEAD_STATUS_ORDER.flatMap((s) => board[s]).find((l) => l.id === activeId) : null;

  async function persistStatusChange(leadId: string, from: LeadStatus, to: LeadStatus) {
    const result = await updateLeadStatusAction(leadId, { status: to });
    if (result.error) {
      // basarisiz oldu - karti eski kolonuna geri al
      setBoard((prev) => {
        const lead = prev[to].find((l) => l.id === leadId);
        if (!lead) return prev;
        return {
          ...prev,
          [to]: prev[to].filter((l) => l.id !== leadId),
          [from]: [{ ...lead, status: from }, ...prev[from]],
        };
      });
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
    dragStartStatus.current = findContainer(board, event.active.id as string) ?? null;
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeContainer = findContainer(board, active.id as string);
    const overContainer = findContainer(board, over.id as string);
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setBoard((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.findIndex((l) => l.id === active.id);
      if (activeIndex === -1) return prev;
      const overIndex = overItems.findIndex((l) => l.id === over.id);
      const newIndex = overIndex >= 0 ? overIndex : overItems.length;
      const movedLead = { ...activeItems[activeIndex], status: overContainer };

      return {
        ...prev,
        [activeContainer]: activeItems.filter((l) => l.id !== active.id),
        [overContainer]: [...overItems.slice(0, newIndex), movedLead, ...overItems.slice(newIndex)],
      };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    const from = dragStartStatus.current;
    dragStartStatus.current = null;
    if (!over || !from) return;

    const finalContainer = findContainer(board, active.id as string);
    if (!finalContainer) return;

    if (from === finalContainer) {
      // ayni kolon icinde siralama - sunucuya kaydedilecek bir "sira" alani yok,
      // sadece surukleme sirasindaki gorsel akiciligi tamamlar.
      const overId = over.id as string;
      setBoard((prev) => {
        const items = prev[finalContainer];
        const activeIndex = items.findIndex((l) => l.id === active.id);
        const overIndex = items.findIndex((l) => l.id === overId);
        if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return prev;
        return { ...prev, [finalContainer]: arrayMove(items, activeIndex, overIndex) };
      });
      return;
    }

    if (finalContainer === "won" && canRecordSale) {
      // board state onDragOver'da zaten kart "Satış" kolonuna tasidi (gorsel
      // onizleme) - ama sunucuya YAZMIYORUZ, once tutar modalini aciyoruz.
      // Vazgecilirse asagida (handleSaleCancel) karti eski kolonuna geri aliriz.
      const lead = board.won.find((l) => l.id === active.id);
      setSaleModal({ leadId: active.id as string, from, name: lead ? `${lead.first_name} ${lead.last_name ?? ""}`.trim() : "" });
      return;
    }

    // Kolonlar arasi tasima: board state onDragOver'da zaten guncellendi, simdi kaydet.
    void persistStatusChange(active.id as string, from, finalContainer);
  }

  function handleQuickMove(leadId: string, from: LeadStatus, to: LeadStatus) {
    if (from === to) return;
    if (to === "won" && canRecordSale) {
      // Board state'i henuz DEGISTIRMIYORUZ - tutar modali onaylanana kadar
      // kart oldugu kolonda kalir (bkz. handleSaleConfirm).
      const lead = board[from].find((l) => l.id === leadId);
      setSaleModal({ leadId, from, name: lead ? `${lead.first_name} ${lead.last_name ?? ""}`.trim() : "" });
      return;
    }
    setBoard((prev) => {
      const lead = prev[from].find((l) => l.id === leadId);
      if (!lead) return prev;
      return {
        ...prev,
        [from]: prev[from].filter((l) => l.id !== leadId),
        [to]: [{ ...lead, status: to }, ...prev[to]],
      };
    });
    void persistStatusChange(leadId, from, to);
  }

  /** Modal "Kaydet ve Taşı" - basarili olursa null, hatali olursa hata metni doner (modal acik kalir). */
  async function handleSaleConfirm(amount: string): Promise<string | null> {
    if (!saleModal) return null;
    const { leadId, from } = saleModal;

    const formData = new FormData();
    formData.set("sale_amount", amount);
    const result = await upsertSaleAction(leadId, { error: null }, formData);
    if (result.error) return result.error;

    // Surukle-birak yolunda kart zaten "won"da (onDragOver) - "Tasi…" yolunda
    // henuz tasinmadi, burada tek seferde her iki durumu da dogru hale getiriyoruz.
    setBoard((prev) => {
      if (prev.won.some((l) => l.id === leadId)) return prev;
      const lead = prev[from].find((l) => l.id === leadId);
      if (!lead) return prev;
      return { ...prev, [from]: prev[from].filter((l) => l.id !== leadId), won: [{ ...lead, status: "won" }, ...prev.won] };
    });
    setSaleModal(null);
    return null;
  }

  /** Modal "Vazgeç" - surukle-birak yolunda onizleme icin "won"a tasinmis karti geri alir. */
  function handleSaleCancel() {
    if (!saleModal) return;
    const { leadId, from } = saleModal;
    setBoard((prev) => {
      if (!prev.won.some((l) => l.id === leadId)) return prev;
      const lead = prev.won.find((l) => l.id === leadId);
      if (!lead) return prev;
      return { ...prev, won: prev.won.filter((l) => l.id !== leadId), [from]: [{ ...lead, status: from }, ...prev[from]] };
    });
    setSaleModal(null);
  }

  return (
    <>
      <DndContext
        id="kanban-board"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="scrollbar-kanban flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2">
          {LEAD_STATUS_ORDER.map((status) => {
            const density: Density = board[status].length > DENSITY_THRESHOLD ? "compact" : "normal";
            return (
              <Column key={status} status={status} count={board[status].length} density={density}>
                <SortableContext items={board[status].map((l) => l.id)} strategy={verticalListSortingStrategy}>
                  {board[status].map((lead) => (
                    <KanbanCard key={lead.id} lead={lead} status={status} density={density} onQuickMove={handleQuickMove} />
                  ))}
                </SortableContext>

                {board[status].length === 0 ? (
                  <p className="rounded-lg border border-dashed border-white/15 px-2 py-4 text-center text-xs text-white/30">
                    Boş
                  </p>
                ) : null}
              </Column>
            );
          })}
        </div>

        <DragOverlay dropAnimation={{ duration: 130, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
          {activeLead ? <CardPreview lead={activeLead} /> : null}
        </DragOverlay>
      </DndContext>

      {saleModal ? (
        <SaleAmountModal leadName={saleModal.name} onConfirm={handleSaleConfirm} onCancel={handleSaleCancel} />
      ) : null}
    </>
  );
}
