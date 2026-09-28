"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Dijital Ajan'in gorsel figuru - "sabit bir resim degil, aktif bir dijital
 * sistem" hissi (spec). Cekirdek konsept (govde YOK, sadece iki avci/kurt
 * gozune benzer, hafif bulanik goz) BILEREK korundu - daha once kullanici
 * tarafindan net sekilde secildi ("cok somut durmasin").
 *
 * REVIZYON (2026-09-30, "göze dokunmak zorundayız, profesyonel bir grafikçi
 * gözüyle bak"): onceki revizyonda eklenen donen "sensor halkalari"
 * KALDIRILDI (spec: "etrafındaki halkayı kaldır" - fazla "gadget" hissi
 * veriyordu, gozun kendisiyle yarisiyordu). Bunun yerine:
 *  - Figur artik KUCUK bir "avatar rozeti" olarak da kusursuz calisacak
 *    sekilde yeniden kuruldu (yuvarlak, yumusak gradyanli bir "chip" zemini
 *    + icinde gozler) - buyuk boyutta da (hero) kucuk boyutta da (sohbet
 *    basligi) ayni kalitede gorunur, spec: "göz çok alan kaplıyor, daha
 *    uygun ve basit bir yere yerleştir" icin KUCUK kullanima tasarlandi.
 *  - Rozet kenarinda ince, SABIT (donmeyen) bir ring - saf bir "cerceve"
 *    hissi, "sensor/radar" degil.
 *  - `state="thinking"` hala var (LLM cevap beklerken) ama artik kucuk bir
 *    kose noktasi (status dot) ile gosteriliyor - buyuk metin etiketi yerine,
 *    gercek chat/avatar urunlerindeki (Slack/Discord) durum noktasi deseni.
 * Goz bebekleri hala fare imlecini takip eder (React state degil dogrudan
 * SVG transform mutasyonu - performans, re-render yok).
 */
export function AgentFigure({
  size = 220,
  state = "idle",
  className,
}: {
  size?: number;
  state?: "idle" | "thinking";
  className?: string;
}) {
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
      const pull = Math.min(dist / 40, 1);
      target.current.x = (dx / dist) * pull;
      target.current.y = (dy / dist) * pull;
    }

    function tick() {
      current.current.x += (target.current.x - current.current.x) * 0.35;
      current.current.y += (target.current.y - current.current.y) * 0.35;

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

  const thinking = state === "thinking";

  return (
    <div
      ref={rootRef}
      className={cn("relative shrink-0 rounded-full", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* AVATAR ROZETI - yuvarlak, yumusak gradyanli zemin + sabit ince cerceve.
          Bu, kucuk boyutta (sohbet basligi) net bir siluet verir; buyuk
          boyutta da fazla yalin kalmaz. "Halka" (donen) DEGIL - sabit. */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-800 via-brand-900 to-black shadow-inner" />
      <div
        className={cn(
          "absolute inset-0 rounded-full ring-1 transition-colors duration-500",
          thinking ? "ring-accent-400/60" : "ring-white/10"
        )}
      />
      <div
        className="agent-glow-pulse absolute inset-0 rounded-full bg-accent-500/25 transition-[animation-duration] duration-300"
        style={{ animationDuration: thinking ? "1.3s" : "4s", filter: `blur(${Math.max(6, size * 0.18)}px)` }}
      />

      <svg viewBox="0 0 220 220" className="relative h-full w-full">
        <defs>
          <radialGradient id="agent-eye-grad" cx="42%" cy="38%" r="70%">
            <stop offset="0%" stopColor="#fff4d6" stopOpacity="0.95" />
            <stop offset="45%" stopColor="var(--color-flame-hot)" stopOpacity="0.92" />
            <stop offset="100%" stopColor="var(--color-flame-ember)" stopOpacity="0.85" />
          </radialGradient>
          <radialGradient id="agent-pupil-grad" cx="38%" cy="32%" r="65%">
            <stop offset="0%" stopColor="#3a1608" stopOpacity="0.95" />
            <stop offset="70%" stopColor="#1c0d05" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#1c0d05" stopOpacity="0.55" />
          </radialGradient>
          <filter id="agent-eye-soft" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>

        <g
          className="agent-breathe"
          filter="url(#agent-eye-soft)"
          style={{ animationDuration: thinking ? "1.6s" : "3.2s" }}
        >
          <g className="agent-blink">
            <path d="M18,92 Q55,83 95,108 Q55,112 18,92 Z" fill="url(#agent-eye-grad)" />
            <path d="M18,92 Q55,83 95,108" fill="none" stroke="#fff4d6" strokeWidth="1.4" strokeOpacity="0.55" strokeLinecap="round" />
            <g ref={leftPupilRef}>
              <circle cx="56" cy="95" r="6.5" fill="url(#agent-pupil-grad)" />
              <circle cx="53.5" cy="92" r="1.5" fill="#fff8ec" opacity="0.9" />
            </g>
          </g>
          <g className="agent-blink">
            <path d="M202,92 Q165,83 125,108 Q165,112 202,92 Z" fill="url(#agent-eye-grad)" />
            <path d="M202,92 Q165,83 125,108" fill="none" stroke="#fff4d6" strokeWidth="1.4" strokeOpacity="0.55" strokeLinecap="round" />
            <g ref={rightPupilRef}>
              <circle cx="165" cy="95" r="6.5" fill="url(#agent-pupil-grad)" />
              <circle cx="162.5" cy="92" r="1.5" fill="#fff8ec" opacity="0.9" />
            </g>
          </g>
        </g>
      </svg>

      {/* DURUM NOKTASI - buyuk metin etiketi yerine kucuk, tanidik bir "aktif/
          dusunuyor" rozeti (Slack/Discord deseni), her boyutta calisir. */}
      <span
        className={cn(
          "absolute bottom-0 right-0 h-[22%] w-[22%] min-h-[9px] min-w-[9px] rounded-full border-2 border-brand-950 transition-colors duration-300",
          thinking ? "bg-accent-400 agent-led" : "bg-success-500"
        )}
      />
    </div>
  );
}
