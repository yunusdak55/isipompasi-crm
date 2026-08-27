"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Dijital Ajan'in gorsel figuru - artik bir "govde" degil, sadece iki
 * buyuk, avci/kurt gozune benzer, hafif bulanik (arka planla kaynasan)
 * goz (spec revizyonu: govde/cekirdek kaldirildi, "cok somut durmasin").
 * Goz bebekleri sayfadaki fare imlecini takip eder - React state degil
 * dogrudan SVG transform mutasyonu (performans, re-render yok).
 */
export function AgentFigure({ size = 220, className }: { size?: number; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const leftPupilRef = useRef<SVGGElement>(null);
  const rightPupilRef = useRef<SVGGElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    function handlePointerMove(e: PointerEvent) {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      // Kucuk bir hareketle bile goz hemen imlece "kilitlensin" diye dusuk
      // bir esik - onceki (260px) deger cok agirdi, fare az hareket ettiginde
      // goz neredeyse tepki vermiyordu (spec: "keskin bir sekilde baksin").
      const pull = Math.min(dist / 40, 1);
      target.current.x = (dx / dist) * pull;
      target.current.y = (dy / dist) * pull;
    }

    function tick() {
      // Daha yuksek lerp orani = daha az gecikme, daha "keskin" bir bakis.
      current.current.x += (target.current.x - current.current.x) * 0.35;
      current.current.y += (target.current.y - current.current.y) * 0.35;

      // Goz bebekleri gozun icinde kalmali ama hareket gozle gorulur olmali
      // (spec revizyonu: "mouseyi guzelce takip etmiyor" - onceki 9/3
      // carpani gozun 77 birimlik genisligine gore fark edilmeyecek kadar
      // kucuktu, neredeyse sabit duruyordu).
      const ox = current.current.x * 24;
      const oy = current.current.y * 8;
      const transform = `translate(${ox}, ${oy})`;
      leftPupilRef.current?.setAttribute("transform", transform);
      rightPupilRef.current?.setAttribute("transform", transform);

      rafId.current = requestAnimationFrame(tick);
    }

    window.addEventListener("pointermove", handlePointerMove);
    rafId.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)} style={{ width: size, height: size }} aria-hidden>
      {/* gozlerin arka planla kaynasmasi icin yumusak ambiyans - "cok somut durmasin" */}
      <div className="agent-glow-pulse absolute inset-0 rounded-full bg-accent-500/25 blur-[54px]" />
      <div className="absolute inset-[24%] rounded-full bg-accent-400/15 blur-[28px]" />

      <svg viewBox="0 0 220 220" className="relative h-full w-full">
        <defs>
          <radialGradient id="agent-eye-grad" cx="42%" cy="38%" r="70%">
            <stop offset="0%" stopColor="#fff4d6" stopOpacity="0.95" />
            <stop offset="45%" stopColor="var(--color-flame-hot)" stopOpacity="0.92" />
            <stop offset="100%" stopColor="var(--color-flame-ember)" stopOpacity="0.85" />
          </radialGradient>
          {/* Goz bebegi icin ayri, sicak-koyu bir gradient - duz siyah yerine
              (spec: "goz bebeklerini iciyle iyice birbirine bindir, uyumlu
              olsun") - iris'in alev paletiyle ayni sicakliktan, kenarda
              yumusayarak iris'e karisiyor. */}
          <radialGradient id="agent-pupil-grad" cx="38%" cy="32%" r="65%">
            <stop offset="0%" stopColor="#3a1608" stopOpacity="0.95" />
            <stop offset="70%" stopColor="#1c0d05" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#1c0d05" stopOpacity="0.55" />
          </radialGradient>
          {/* hafif blur filtresi - once 1.6 idi, "ikonik/estetik" istegiyle
              dusuruldu: gozler artik net bir sekil olarak okunuyor, tamamen
              keskin/yapiskan-sticker de degil (spec: "daha ikonik ve estetik
              hale getir"). */}
          <filter id="agent-eye-soft" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>

        {/* AVCI GOZU - disa donuk kose keskin/yukari kalkik, ic kose daha
            yuvarlak/alcak (uzgun degil, odaklanmis/keskin ifade). Koordinatlar
            doğrudan bu sekilde yazildi - rotate() KULLANILMADI (yon
            belirsizligi yaratmasin diye). Goz bebekleri AYNI blurlu grup
            icinde - iris + bebek tek parca olarak render+blur edilir, boylece
            bebek iris'in uzerine "yapistirilmis" degil, onunla kaynasmis gibi
            gorunur. */}
        <g className="agent-breathe" filter="url(#agent-eye-soft)">
          <path d="M18,92 Q55,83 95,108 Q55,112 18,92 Z" fill="url(#agent-eye-grad)" />
          <path d="M202,92 Q165,83 125,108 Q165,112 202,92 Z" fill="url(#agent-eye-grad)" />
          {/* ust kenar boyunca ince, parlak bir rim - gozun siluetini netlestirip
              "ikonik" bir kenar cizgisi verir (spec: "daha ikonik ve estetik") */}
          <path d="M18,92 Q55,83 95,108" fill="none" stroke="#fff4d6" strokeWidth="1.4" strokeOpacity="0.55" strokeLinecap="round" />
          <path d="M202,92 Q165,83 125,108" fill="none" stroke="#fff4d6" strokeWidth="1.4" strokeOpacity="0.55" strokeLinecap="round" />

          <g ref={leftPupilRef}>
            <circle cx="56" cy="95" r="6.5" fill="url(#agent-pupil-grad)" />
            {/* parlama noktasi - goze "canli/cam" hissi verir, bebekle birlikte hareket eder */}
            <circle cx="53.5" cy="92" r="1.5" fill="#fff8ec" opacity="0.9" />
          </g>
          <g ref={rightPupilRef}>
            <circle cx="165" cy="95" r="6.5" fill="url(#agent-pupil-grad)" />
            <circle cx="162.5" cy="92" r="1.5" fill="#fff8ec" opacity="0.9" />
          </g>
        </g>
      </svg>
    </div>
  );
}
