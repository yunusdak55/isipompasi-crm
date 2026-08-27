"use client";

import { useActionState, useEffect, useRef } from "react";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { signInAction, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

/**
 * Giris karti, imlecin konumuna gore ÇOK hafif bir 3D egim (tilt) alir -
 * spotlight/isik takibi DEGIL (bu daha once acikca kaldirilmisti), sadece
 * kartin kendisi imlece dogru hafifce "donuyor" hissi - premium SaaS
 * giris ekranlarinda yaygin, sade ve zarif bir dokunus. HvacBackdrop'taki
 * ayni RAF/lerp yumusatma deseniyle tutarli, React state kullanmadan
 * dogrudan DOM transform mutasyonu (performans, re-render yok).
 */
function useCardTilt() {
  const cardRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    function handlePointerMove(e: PointerEvent) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      target.current.x = (e.clientX / vw - 0.5) * 2;
      target.current.y = (e.clientY / vh - 0.5) * 2;
    }
    function handlePointerLeave() {
      target.current.x = 0;
      target.current.y = 0;
    }

    function tick() {
      current.current.x += (target.current.x - current.current.x) * 0.06;
      current.current.y += (target.current.y - current.current.y) * 0.06;

      if (cardRef.current) {
        const rotateY = current.current.x * 3.5;
        const rotateX = current.current.y * -3.5;
        cardRef.current.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      }

      rafId.current = requestAnimationFrame(tick);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerleave", handlePointerLeave);
    rafId.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return cardRef;
}

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signInAction, initialState);
  const cardRef = useCardTilt();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-900 to-brand-950 px-4">
      <HvacBackdrop intensity="hero" interactive />

      <div className="relative w-full max-w-sm">
        <div className="animate-slide-up mb-8 flex flex-col items-center gap-3 text-center">
          <div className="relative flex items-center justify-center py-1">
            <span className="mark-glow-pulse absolute inset-[-16px] rounded-full bg-accent-500/30 blur-xl" aria-hidden />
            <Logo className="relative h-9" />
          </div>
          <div>
            <p className="mt-1 text-base font-medium text-white/90">Sektörde büyümenin kontrolü sizde.</p>
            <p className="mt-1 text-sm text-white/50">Isı Pompası &amp; İklimlendirme Firmalarının Büyüme Ortağı</p>
          </div>
        </div>

        <div ref={cardRef} className="transition-transform duration-75 ease-out" style={{ transformStyle: "preserve-3d" }}>
          <form
            action={formAction}
            className="animate-slide-up rounded-2xl border border-line bg-surface p-6 shadow-elevated-lg"
          >
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink-900">E-posta</span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="ornek@firma.com"
                  className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.03]"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink-900">Şifre</span>
                <input
                  type="password"
                  name="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.03]"
                />
              </label>

              {state.error ? (
                <p role="alert" className="animate-slide-up rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-[#ffb4a3]">
                  {state.error}
                </p>
              ) : null}

              <Button type="submit" disabled={isPending} className="mt-1 w-full">
                {isPending ? "Giriş yapılıyor…" : "Giriş Yap"}
              </Button>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-white/40">
          Hesabınız yok mu? Firma yönetici hesabınız ajans tarafından oluşturulur.
        </p>
      </div>
    </div>
  );
}
