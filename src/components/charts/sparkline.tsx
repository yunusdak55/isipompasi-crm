import { cn } from "@/lib/utils";

/**
 * Minik trend cizgisi (kartlarin kosesinde). Saf SVG, sunucuda uretilir, JS yok:
 * cizgi acilista bir kez "cizilir" (stroke-dashoffset, globals.css spark-draw),
 * altindaki alan yumusakca belirir. Tek nokta/duz veri icin dogru ve sakin davranir.
 */
export function Sparkline({
  values,
  width = 112,
  height = 36,
  color = "#f47c20",
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  if (values.length < 2) return null;

  const pad = 3;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const stepX = (width - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * stepX;
    // Tamamen duz veri (hepsi esit) -> ortada duz cizgi; aksi halde min..max araligina oturt.
    const y = max === min ? height / 2 : height - pad - ((v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });

  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L ${pts[pts.length - 1][0].toFixed(1)} ${height} L ${pts[0][0].toFixed(1)} ${height} Z`;
  const gid = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;
  const [lx, ly] = pts[pts.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn("overflow-visible", className)} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} className="spark-area" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="spark-line" />
      <circle cx={lx} cy={ly} r="2.6" fill={color} className="spark-dot" />
    </svg>
  );
}
