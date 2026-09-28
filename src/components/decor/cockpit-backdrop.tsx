import { cn } from "@/lib/utils";

/**
 * Satış Kokpiti hero'su icin soyut, markasiz atmosfer katmani (spec
 * 2026-10-01: "havanin akisini, isiyi ve bolgesel yayilimi cagristiran ince
 * cizgiler, enerji halkalari"). HvacBackdrop'un aksine (boru semasi + dis
 * unite siluweti) burada TAMAMEN soyut: merkezden disari yayilan enerji
 * halkalari (reklamin/hizmetin BOLGESEL yayilimi) + zemini capraz kesen
 * ince akis cizgileri (hava/isi hareketi). Stok gorsel/foto yok, saf SVG.
 */
export function CockpitBackdrop({ className }: { className?: string }) {
  return (
    <svg
      className={cn("absolute inset-0 h-full w-full", className)}
      viewBox="0 0 1180 320"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden
    >
      {/* Bolgesel yayilim: odak noktasindan disari genisleyen enerji halkalari. */}
      <g transform="translate(940,90)" stroke="var(--color-accent-500)">
        <circle r="30" strokeOpacity="0.35" strokeWidth="1.2" />
        <circle r="65" strokeOpacity="0.22" strokeWidth="1.2" />
        <circle r="105" strokeOpacity="0.14" strokeWidth="1.2" />
        <circle r="150" strokeOpacity="0.08" strokeWidth="1.2" />
        <circle r="7" fill="var(--color-accent-500)" fillOpacity="0.6" stroke="none" />
      </g>
      {/* Hava/isi akis cizgileri. */}
      <g stroke="var(--color-brand-200)" strokeOpacity="0.16" strokeWidth="1.2" strokeLinecap="round">
        <path d="M -20 250 C 200 210, 320 280, 520 220 S 820 140, 1200 190" />
        <path d="M -20 60 C 180 110, 300 40, 540 90 S 900 40, 1200 70" />
      </g>
    </svg>
  );
}
