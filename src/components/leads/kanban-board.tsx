"use client";

import { memo, useRef, useState } from "react";
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
import { LEAD_STATUS_ORDER, LEAD_STATUS_LABELS, LEAD_STATUS_CHART_COLOR } from "@/lib/constants/lead";
import { Button } from "@/components/ui/button";
import { NewLeadBadge, OverdueBadge } from "@/components/leads/lead-indicators";
import { cn, formatCurrency, isLeadNew, isLeadOverdue, leadContactPerson, leadDisplayName } from "@/lib/utils";
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

/**
 * Durum degisince kart hedef kolonun EN USTUNE zipliyordu (bildirilen bug:
 * "duzenleme yapildiginda ayni yerde kalsin, asagidan yukari cikmasin").
 * Sunucu listeleri hep created_at DESC sirali (bkz. getLeadsForBoard) - kart
 * buraya rastgele/en basa degil, ayni siraya denk gelecek sekilde eklenir,
 * boylece sayfa yenilenince de goruntu degismez.
 */
function insertByCreatedAt(items: BoardLead[], lead: BoardLead): BoardLead[] {
  const index = items.findIndex((item) => new Date(item.created_at).getTime() < new Date(lead.created_at).getTime());
  if (index === -1) return [...items, lead];
  return [...items.slice(0, index), lead, ...items.slice(index)];
}

type Density = "normal" | "compact";

// Adaptif yoğunluk: kolon başına lead sayısı arttıkça kartlar kaba bir
// "sürekli küçültme" yerine İKİ ayrı, kontrollü tipografi/spacing kademesi
// arasında geçiş yapar (spec: "gerektiğinde kontrollü şekilde küçülmeli").
// Eşiğin üstünde bile okunabilirlik bozulursa güvenlik ağı kolon içi
// dikey scroll'dur (bkz. Column) - kartlar asla ekranı taşırmaz.
const DENSITY_THRESHOLD = 8;

/**
 * DUZELTME (performans denetimi 2026-10-01, canli kanit: izole test ortaminda
 * 5.000 lead'lik bir firma icin Chrome'da olculdu - gercek sürükleme/kaydirma
 * sirasinda 19 kare 50ms+ surdu, EN KOTU kare 1197ms (tam 1.2 saniyelik bir
 * "donma"). Kok sebep: TUM kartlar (kac tane olursa olsun) ayni anda DOM'a
 * yaziliyordu - 5.000 lead'de bu panoda 77.715 DOM dugumu olusturuyordu
 * (saglikli bir sayfa birkaç yuz-bin dugum olur). React.memo (yukarida,
 * KanbanCard) gereksiz YENIDEN RENDER'i onledi ama asil maliyet tarayicinin
 * bu kadar buyuk bir DOM agacinda yapmak zorunda oldugu duzen/boyama
 * (layout/paint) hesaplamasiydi - memo bunu COZEMEZ.
 *
 * COZUM: dnd-kit'in sortable sanallaştırmasi (gercek "windowing") karmasik
 * ve surukle-birak'i bozma riski tasiyordu, bu yuzden daha GUVENLI bir yol
 * secildi - HICBIR VERI KAYBOLMAZ/GIZLENMEZ, sadece kolon basina ayni anda
 * DOM'a yazilan kart sayisi sinirlanir, "daha fazla goster" ile acilir.
 * Gercek production olcegi (bkz. canli firma: ~311 toplam lead) bu sinirin
 * COK altinda - gercek kullanicilar bu sinirla hic karsilasmaz, sadece
 * stres-testi olcegindeki (binlerce lead) firmalarda devreye girer.
 */
const RENDER_LIMIT_PER_COLUMN = 100;
const REVEAL_STEP = 200;

// DUZELTME (performans denetimi 2026-10-01, kanit: kod incelemesi - canli
// olcum, oturum acma otomasyonu guvenlik sinirlamasi yuzunden alinamadi,
// bkz. rapor). Bu bilesen memo() OLMADAN her board state degisikliginde
// (ör. surukleme sirasinda handleDragOver'in HER tetiklenisinde) TUM
// kolonlardaki TUM kartlar icin yeniden calisiyordu - buyuk bir firma
// (binlerce lead) icin tek bir surukleme hareketi binlerce bilesen
// fonksiyonunu + binlerce useSortable() kancasini tekrar calistirabiliyordu.
// `onQuickMove` KASITLI OLARAK karsilastirmaya dahil edilmedi: KanbanBoard
// icinde her render'da yeniden olusturuluyor (useCallback'e sarilmadi,
// board state'ine bagimli) - onu dahil etmek memo'yu buyuk olcude etkisiz
// kilardi. Degismeden kalsa bile DAVRANIS bozulmaz: bu callback her zaman
// GUNCEL lead/board bilgisini kapatilan (closure) degil setBoard'un
// FONKSIYONEL formuyla okur - tek istisna (satış adi onizlemesi icin
// board[from] okuyan satir) en kotu ihtimalle ayni lead nesnesini (zaten
// degismedigi icin, bu kart yeniden render edilmediyse) bulur.
const KanbanCard = memo(function KanbanCard({
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

  const overdueInput = {
    status: lead.status,
    lastContactAt: lead.last_contact_at,
    createdAt: lead.created_at,
    nextFollowupAt: lead.next_followup_at,
    lastActivityAt: lead.last_activity_at,
  };
  const showOverdue = isLeadOverdue(overdueInput);
  const showNew = isLeadNew(overdueInput);
  const compact = density === "compact";

  return (
    <div
      ref={setNodeRef}
      // Sol kenar seridi durumun rengini tasir (Lead/Kesif/Takip/Satis/Kayip) - kart hangi
      // kolondan gelirse gelsin (surukleme sirasinda dahi) bir bakista taninir.
      style={{ transform: CSS.Transform.toString(transform), transition, borderLeftColor: LEAD_STATUS_CHART_COLOR[status] }}
      {...attributes}
      {...listeners}
      className={cn(
        "group/card flex touch-none cursor-grab flex-col rounded-lg border border-l-[3px] border-white/10 bg-gradient-to-b from-white/[0.085] to-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-[border-color,background-color,translate] duration-150 ease-snappy hover:-translate-y-0.5 hover:border-white/20 hover:from-white/[0.12] active:cursor-grabbing",
        compact ? "gap-1 p-2 text-[13px]" : "gap-2 p-3 text-sm",
        isDragging && "opacity-0"
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {showOverdue ? <OverdueBadge className={compact ? "px-1.5 py-0.5 text-[9px]" : undefined} /> : null}
        <Link
          href={`/leads/${lead.id}`}
          className={cn("truncate font-medium text-white transition-colors hover:text-accent-300", status === "lost" && "lost-name")}
        >
          {leadDisplayName(lead)}
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
        {leadContactPerson(lead) ?? "Belirtilmedi"}
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
          // Sakin varsayilan (kartin gorsel gurultusunu azaltir), hover/odakta belirginlesir.
          "w-full rounded-md border border-transparent bg-white/[0.04] text-white/40 transition-colors duration-150 group-hover/card:border-white/15 group-hover/card:bg-white/[0.08] group-hover/card:text-white/75 focus-visible:border-accent-400 [&>option]:text-[#111827]",
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
},
(prev, next) => prev.lead === next.lead && prev.status === next.status && prev.density === next.density);

/** Kart surukleniyorken imleci takip eden "kaldirilmis" gorsel (DragOverlay). */
function CardPreview({ lead }: { lead: BoardLead }) {
  return (
    <div className="animate-scale-in flex w-64 origin-center scale-[1.045] cursor-grabbing flex-col gap-2 rounded-lg border border-accent-200 bg-surface p-3 text-sm shadow-glow-accent-lg ring-2 ring-accent-500/15">
      <p className="truncate font-medium text-ink-900">
        {leadDisplayName(lead)}
      </p>
      <p className="truncate text-xs text-ink-600">
        {lead.phone}
        {lead.city ? ` · ${lead.city}` : ""}
      </p>
      <p className="truncate text-xs text-ink-600">{leadContactPerson(lead) ?? "Belirtilmedi"}</p>
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
        "relative flex h-full w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-[border-color,background-color,box-shadow] duration-150 ease-snappy",
        isOver && "border-accent-400/50 bg-accent-500/[0.08] shadow-glow-accent ring-1 ring-inset ring-accent-400/30"
      )}
    >
      {/* Kolon ust kenarinda durum renginde ince isik cizgisi. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-4 top-0 h-[2px] rounded-full"
        style={{ background: `linear-gradient(90deg, transparent, ${LEAD_STATUS_CHART_COLOR[status]}, transparent)` }}
      />
      <div className="flex shrink-0 items-center justify-between px-1 pb-2.5 pt-1">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/60">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: LEAD_STATUS_CHART_COLOR[status], boxShadow: `0 0 8px ${LEAD_STATUS_CHART_COLOR[status]}99` }}
          />
          {LEAD_STATUS_LABELS[status]}
        </span>
        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white/65">{count}</span>
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
  columnTotals,
  canRecordSale,
}: {
  initialLeadsByStatus: BoardState;
  /** Her kolonun sunucudaki GERCEK toplami (yuklenen kart sayisindan buyuk olabilir - bkz. BOARD_COLUMN_CAP). */
  columnTotals: Record<LeadStatus, number>;
  canRecordSale: boolean;
}) {
  const [board, setBoard] = useState<BoardState>(initialLeadsByStatus);
  // Ilk yuklenen toplamlar + kart sayilari BIRLIKTE sabitlenir (board state'iyle ayni "an"):
  // bir tasima sonrasi sunucu sayfayi yeniden dogrulayip yeni `columnTotals` gonderse bile
  // (zaten tasimayi icerir) yerel fark bir kez daha eklenip toplam IKI KEZ kaymasin.
  const [baseTotals] = useState(columnTotals);
  const [initialLens] = useState(
    () => Object.fromEntries(LEAD_STATUS_ORDER.map((s) => [s, initialLeadsByStatus[s].length])) as Record<LeadStatus, number>
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragStartStatus = useRef<LeadStatus | null>(null);
  // "Satış"a taşınırken tutar isteyen modal - hem surukle-birak hem "Taşı…"
  // dropdown'u ayni akisi kullanir (spec: "satışa sürüklediğimizde satış
  // miktarını soracak bi kutucuk gelsin, onu girince oraya yerleştirilsin").
  const [saleModal, setSaleModal] = useState<{ leadId: string; from: LeadStatus; name: string } | null>(null);
  // "sales" rolu (canRecordSale=false) bir karti dogrudan "Satış"a suruklerse
  // sunucu bunu reddeder (bkz. actions.ts updateLeadStatusAction guvenlik agi)
  // ve kart eski koluna geri doner - kullaniciya NEDENINI gostermezsek sessizce
  // "olmadi" gibi gorunur, kafa karistirir.
  const [moveError, setMoveError] = useState<string | null>(null);
  // Kolon basina ayni anda DOM'a yazilan kart sayisi (bkz. RENDER_LIMIT_PER_COLUMN
  // yorumu) - "daha fazla goster" ile buyur, HICBIR veri gizlenmez/kaybolmaz.
  const [revealCount, setRevealCount] = useState<Record<LeadStatus, number>>(
    () => Object.fromEntries(LEAD_STATUS_ORDER.map((s) => [s, RENDER_LIMIT_PER_COLUMN])) as Record<LeadStatus, number>
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeLead = activeId ? LEAD_STATUS_ORDER.flatMap((s) => board[s]).find((l) => l.id === activeId) : null;

  async function persistStatusChange(leadId: string, from: LeadStatus, to: LeadStatus) {
    const result = await updateLeadStatusAction(leadId, { status: to });
    if (result.error) {
      setMoveError(result.error);
      // basarisiz oldu - karti eski kolonuna geri al
      setBoard((prev) => {
        const lead = prev[to].find((l) => l.id === leadId);
        if (!lead) return prev;
        return {
          ...prev,
          [to]: prev[to].filter((l) => l.id !== leadId),
          [from]: insertByCreatedAt(prev[from], { ...lead, status: from }),
        };
      });
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setMoveError(null);
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
      setSaleModal({ leadId: active.id as string, from, name: lead ? leadDisplayName(lead) : "" });
      return;
    }

    // Kolonlar arasi tasima: board state onDragOver'da zaten guncellendi, simdi kaydet.
    void persistStatusChange(active.id as string, from, finalContainer);
  }

  function handleQuickMove(leadId: string, from: LeadStatus, to: LeadStatus) {
    if (from === to) return;
    setMoveError(null);
    if (to === "won" && canRecordSale) {
      // Board state'i henuz DEGISTIRMIYORUZ - tutar modali onaylanana kadar
      // kart oldugu kolonda kalir (bkz. handleSaleConfirm).
      const lead = board[from].find((l) => l.id === leadId);
      setSaleModal({ leadId, from, name: lead ? leadDisplayName(lead) : "" });
      return;
    }
    setBoard((prev) => {
      const lead = prev[from].find((l) => l.id === leadId);
      if (!lead) return prev;
      return {
        ...prev,
        [from]: prev[from].filter((l) => l.id !== leadId),
        [to]: insertByCreatedAt(prev[to], { ...lead, status: to }),
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
      return { ...prev, [from]: prev[from].filter((l) => l.id !== leadId), won: insertByCreatedAt(prev.won, { ...lead, status: "won" }) };
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
      return { ...prev, won: prev.won.filter((l) => l.id !== leadId), [from]: insertByCreatedAt(prev[from], { ...lead, status: from }) };
    });
    setSaleModal(null);
  }

  return (
    <>
      {moveError ? (
        <p role="alert" className="animate-fade-in mb-3 rounded-lg border border-danger-500/30 bg-danger-500/10 px-3.5 py-2 text-xs font-medium text-[#ffb4a3]">
          {moveError}
        </p>
      ) : null}
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
            const columnLeads = board[status];
            const visibleCount = Math.min(revealCount[status], columnLeads.length);
            const visibleLeads = columnLeads.slice(0, visibleCount);
            const remaining = columnLeads.length - visibleCount;
            // Kolon toplami = sunucudaki gercek toplam +/- bu oturumdaki yerel tasimalar.
            const total = baseTotals[status] + (columnLeads.length - initialLens[status]);
            const notLoaded = Math.max(0, total - columnLeads.length);
            return (
              <Column key={status} status={status} count={total} density={density}>
                <SortableContext items={visibleLeads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                  {visibleLeads.map((lead) => (
                    <KanbanCard key={lead.id} lead={lead} status={status} density={density} onQuickMove={handleQuickMove} />
                  ))}
                </SortableContext>

                {columnLeads.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-white/15 px-2 py-4 text-center text-xs text-white/30">
                    Boş
                  </p>
                ) : null}

                {remaining > 0 ? (
                  <button
                    type="button"
                    onClick={() => setRevealCount((prev) => ({ ...prev, [status]: prev[status] + REVEAL_STEP }))}
                    className="mt-1 shrink-0 rounded-lg border border-dashed border-white/15 px-2 py-2 text-center text-xs text-white/50 transition-colors duration-150 hover:border-white/25 hover:text-white/75"
                  >
                    + {Math.min(remaining, REVEAL_STEP)} daha göster ({remaining} kaldı)
                  </button>
                ) : null}

                {notLoaded > 0 ? (
                  <Link
                    href={`/leads?status=${status}`}
                    className="mt-1 shrink-0 rounded-lg border border-dashed border-warning-500/40 bg-warning-500/[0.07] px-2 py-2 text-center text-[11px] leading-snug text-warning-100 transition-colors duration-150 hover:bg-warning-500/[0.14]"
                  >
                    En yeni {columnLeads.length.toLocaleString("tr-TR")} lead gösteriliyor · {notLoaded.toLocaleString("tr-TR")} lead daha var.
                    Tümü için Liste Görünümü →
                  </Link>
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
