/* eslint-disable @next/next/no-img-element */

/**
 * Marka logosu - arka plani kaldirilmis, siki kirpilmis orijinal gorsel
 * (1243x236, ~5.27:1 oran). h-* class'iyla yukseklik verilip genislik
 * otomatik olceklenir.
 */
export function Logo({ className }: { className?: string }) {
  return <img src="/logo.png" alt="İklimlen" className={`w-auto ${className ?? ""}`} />;
}
