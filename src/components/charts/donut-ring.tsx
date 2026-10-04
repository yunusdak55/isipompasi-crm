import { cn } from "@/lib/utils";

export type DonutSegment = { key: string; value: number; color: string };

/**
 * Ortak HALKA (donut) grafigi - Dashboard "Satis Hatti" ve Raporlar "Aylik
 * Karsilastirma" AYNI bileseni kullanir (tek gorsel dil). Saf SVG, sunucuda
 * uretilir; dilimler arasi bosluk + butt uc, acilista her dilim sirayla cizilir
 * (globals.css donut-draw: TEK seferlik). Filtre/blur yok; `glow` yalnizca
 * dilim basina hafif bir renkli golge ekler (statik).
 */
export function DonutRing({
  segments,
  size = 140,
  stroke = 14,
  gap = 4,
  glow = false,
  ariaLabel,
  className,
  children,
}: {
  segments: DonutSegment[];
  size?: number;
  stroke?: number;
  gap?: number;
  glow?: boolean;
  ariaLabel: string;
  className?: string;
  /** Halkanin ortasina yazilan icerik. */
  children?: React.ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const visible = segments.filter((s) => s.value > 0);
  const total = visible.reduce((sum, s) => sum + s.value, 0);
  const single = visible.length === 1;

  const arcs = visible.map((seg, i) => {
    const before = visible.slice(0, i).reduce((sum, v) => sum + (v.value / total) * circ, 0);
    const arc = (seg.value / total) * circ;
    const len = single ? circ : Math.max(1, arc - gap);
    return { ...seg, len, offset: -(before + (single ? 0 : gap / 2)), delay: i * 90 };
  });

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={ariaLabel}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        {arcs.map((a) => (
          <circle
            key={a.key}
            className="donut-seg"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeDashoffset={a.offset}
            style={
              {
                stroke: a.color,
                "--len": a.len,
                "--rest": circ - a.len,
                "--circ": circ,
                animationDelay: `${a.delay}ms`,
                filter: glow ? `drop-shadow(0 0 5px ${a.color}66)` : undefined,
              } as React.CSSProperties
            }
          />
        ))}
      </svg>
      {children ? <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div> : null}
    </div>
  );
}
