"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Markasiz, jenerik "teknik HVAC/isi pompasi" atmosfer katmani. Gercek bir
 * urun/logo/foto DEGIL - saf SVG ile cizilmis boru guzergahi + baglanti
 * noktalari + bir disari unite (isi pompasi) siluweti + ince bir blueprint
 * nokta izgarasi. Koyu lacivert zeminler icin tasarlandi.
 *
 * interactive=true oldugunda (sadece login hero) arka plan katmanlari
 * (glow/svg) imlecin konumuna gore YAVAS/agir bir "okyanus" paralaksiyla
 * suruklenir (derinlik hissi) - RAF donguzunde lerp ile yumusatiliyor.
 * React state degil dogrudan DOM/style mutasyonu (performans, re-render yok).
 */
export function HvacBackdrop({
  className,
  intensity = "ambient",
  interactive = false,
}: {
  className?: string;
  intensity?: "ambient" | "hero";
  interactive?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const glow1Ref = useRef<HTMLDivElement>(null);
  const glow2Ref = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const isHero = intensity === "hero";
  const lineOpacity = isHero ? 0.18 : 0.09;
  const nodeOpacity = isHero ? 0.9 : 0.6;
  const gridOpacity = isHero ? 0.05 : 0.035;
  const unitOpacity = isHero ? 0.5 : 0.22;
  const unitDetailOpacity = isHero ? 0.7 : 0.32;

  // Hedef (imlecin gercek konumu, konteynere gore -0.5..0.5 normalize) +
  // agir/derin bir gecikmeyle yumusatilmis surukleme konumu.
  const target = useRef({ x: 0, y: 0 });
  const drift = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    if (!interactive) return;

    function tick() {
      drift.current.x += (target.current.x - drift.current.x) * 0.045;
      drift.current.y += (target.current.y - drift.current.y) * 0.045;

      const dx = drift.current.x;
      const dy = drift.current.y;

      if (glow1Ref.current) glow1Ref.current.style.transform = `translate3d(${dx * 64}px, ${dy * 64}px, 0)`;
      if (glow2Ref.current) glow2Ref.current.style.transform = `translate3d(${dx * -46}px, ${dy * -46}px, 0)`;
      if (svgRef.current) svgRef.current.style.transform = `translate3d(${dx * 20}px, ${dy * 20}px, 0)`;

      rafId.current = requestAnimationFrame(tick);
    }

    rafId.current = requestAnimationFrame(tick);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [interactive]);

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!interactive || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    target.current.x = (e.clientX - rect.left) / rect.width - 0.5;
    target.current.y = (e.clientY - rect.top) / rect.height - 0.5;
  }

  function handlePointerLeave() {
    if (!interactive) return;
    target.current.x = 0;
    target.current.y = 0;
  }

  return (
    <div
      ref={rootRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={cn(
        "absolute inset-0 overflow-hidden",
        interactive ? "pointer-events-auto" : "pointer-events-none",
        className
      )}
      aria-hidden
    >
      {/* Ambient glow'lar - lacivert zeminde derinlik + tek, kontrollu turuncu vurgu.
          Turuncu glow, isi pompasi siluetinin arkasinda durup onu "sicak isikla
          arkadan aydinlatiyor" hissi verecek sekilde konumlandi. */}
      <div
        ref={glow1Ref}
        className="absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-brand-500/30 blur-[110px] transition-transform duration-300 ease-out"
      />
      <div
        ref={glow2Ref}
        className="absolute -bottom-32 -right-20 h-[520px] w-[520px] rounded-full bg-accent-500/[0.16] blur-[140px] transition-transform duration-300 ease-out"
      />

      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full transition-transform duration-300 ease-out"
        viewBox="0 0 1400 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          <pattern id="hvac-grid" width="42" height="42" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="white" opacity={gridOpacity} />
          </pattern>
          {/* Isi pompasi silueti hafifce odak-disi (blur) - "arka tarafa fazla
              sirtmayacak" (spec), keskin teknik cizgilerden (boru semasi) gorsel
              olarak ayrisip derinlik katmani olusturur. */}
          <filter id="hvac-unit-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        <rect width="1400" height="900" fill="url(#hvac-grid)" />

        {/* Boru guzergahlari - dik acili, HVAC/tesisat semasina gonderme.
            isHero'da ince noktali bir "akis" animasyonu var (spec: "daha
            animasyonlu ve efektif") - borularda enerji/sivi akiyormus hissi. */}
        <g
          stroke="white"
          strokeOpacity={lineOpacity}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={isHero ? "1 11" : undefined}
          className={isHero ? "hvac-flow" : undefined}
        >
          <path d="M 90 780 L 90 460 L 280 460 L 280 220" />
          <path d="M 280 220 L 520 220 L 520 90" />
          <path d="M 980 60 L 980 280 L 1220 280 L 1220 540" />
          <path d="M 260 870 L 260 660 L 500 660 L 500 500 L 700 500" />
          <path d="M 700 500 L 700 340 L 900 340" />
        </g>

        {/* Baglanti/vana noktalari */}
        <g fill="white" fillOpacity={nodeOpacity * 0.35}>
          <circle cx="280" cy="460" r="4" />
          <circle cx="280" cy="220" r="4" />
          <circle cx="520" cy="220" r="4" />
          <circle cx="980" cy="280" r="4" />
          <circle cx="1220" cy="280" r="4" />
          <circle cx="260" cy="660" r="4" />
          <circle cx="500" cy="660" r="4" />
          <circle cx="500" cy="500" r="4" />
          <circle cx="700" cy="500" r="4" />
          <circle cx="700" cy="340" r="4" />
        </g>

        {/* Vurgulu "vana" dugumu - turuncu, marka imzasi. isHero'da yavasca
            nefes alir (sistem "canli" hissi). */}
        <g className={isHero ? "hvac-pulse" : undefined}>
          <circle cx="520" cy="90" r="9" stroke="var(--color-accent-500)" strokeOpacity={nodeOpacity} strokeWidth="2" />
          <circle cx="520" cy="90" r="2.5" fill="var(--color-accent-500)" fillOpacity={nodeOpacity} />
        </g>

        {/* ISI POMPASI DIS UNITESI - siyah, dusuk opacity + hafif blur siluet.
            Turuncu glow'un (sag alt) hemen onunde durur - "sicak isikla
            arkadan aydinlanmis" kompozisyonu. Jenerik/markasiz kompakt kutu:
            genis daire fan izgarasi govdenin cogunu kaplar (referans: tekli
            fanli dis unite), solda dar bir petek/coil seridi, ustte kucuk
            kontrol paneli detayi. */}
        <g transform="translate(950, 555)" filter="url(#hvac-unit-blur)">
          <rect x="0" y="0" width="320" height="215" rx="22" fill="black" opacity={unitOpacity} />
          {/* kucuk kontrol paneli detayi (marka/logo DEGIL - sade dikdortgen) */}
          <rect x="18" y="18" width="34" height="12" rx="3" fill="black" fillOpacity={unitDetailOpacity * 0.6} />
          {/* dar petek/coil seridi (sol) */}
          <g stroke="black" strokeOpacity={unitDetailOpacity} strokeWidth="3">
            <line x1="20" y1="52" x2="95" y2="52" />
            <line x1="20" y1="70" x2="95" y2="70" />
            <line x1="20" y1="88" x2="95" y2="88" />
            <line x1="20" y1="106" x2="95" y2="106" />
            <line x1="20" y1="124" x2="95" y2="124" />
            <line x1="20" y1="142" x2="95" y2="142" />
            <line x1="20" y1="160" x2="95" y2="160" />
            <line x1="20" y1="178" x2="95" y2="178" />
          </g>
          {/* genis fan izgarasi - govdenin baskin unsuru */}
          <circle cx="212" cy="112" r="92" stroke="black" strokeOpacity={unitDetailOpacity} strokeWidth="3.5" />
          <circle cx="212" cy="112" r="68" stroke="black" strokeOpacity={unitDetailOpacity * 0.8} strokeWidth="2" />
          <circle cx="212" cy="112" r="9" fill="black" fillOpacity={unitDetailOpacity} />
          <g stroke="black" strokeOpacity={unitDetailOpacity * 0.7} strokeWidth="2" strokeLinecap="round">
            <line x1="212" y1="112" x2="212" y2="30" />
            <line x1="212" y1="112" x2="280" y2="70" />
            <line x1="212" y1="112" x2="280" y2="154" />
            <line x1="212" y1="112" x2="212" y2="194" />
            <line x1="212" y1="112" x2="144" y2="154" />
            <line x1="212" y1="112" x2="144" y2="70" />
          </g>
          {/* ayaklar */}
          <rect x="10" y="213" width="20" height="14" rx="3" fill="black" opacity={unitOpacity} />
          <rect x="290" y="213" width="20" height="14" rx="3" fill="black" opacity={unitOpacity} />
        </g>
      </svg>
    </div>
  );
}
