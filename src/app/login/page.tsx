"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { FlowLogo, LoginScene } from "@/components/decor/login-scene";
import { fxIsLite, reduceMotion } from "@/lib/fx";
import { cn } from "@/lib/utils";
import { signInAction, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

/**
 * Derinlik: imlec hareket edince sahne katmanlari farkli hizda kayar, kart
 * imlece dogru COK hafif egilir (isik takibi/spotlight YOK - daha once
 * kaldirilmisti). RAF dongusu yalnizca hedefe yaklasana kadar calisir, sonra
 * durur (eskiden sayfa acik kaldikca saniyede 60 kez donuyordu). Dokunmatik
 * cihazda, hafif modda ve "hareketi azalt" acikken hic calismaz.
 */
function useDepth() {
  const cardRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduceMotion() || !window.matchMedia("(pointer: fine)").matches) return;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    let raf: number | null = null;

    const layers = () => Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-depth]") ?? []);

    const tick = () => {
      cur.x += (target.x - cur.x) * 0.06;
      cur.y += (target.y - cur.y) * 0.06;
      for (const el of layers()) {
        const d = Number(el.dataset.depth);
        el.style.transform = `translate3d(${(cur.x * -14 * d).toFixed(2)}px, ${(cur.y * -10 * d).toFixed(2)}px, 0)`;
      }
      if (cardRef.current) {
        cardRef.current.style.transform = `perspective(900px) rotateX(${(cur.y * -3).toFixed(2)}deg) rotateY(${(cur.x * 3).toFixed(2)}deg)`;
      }
      const settled = Math.abs(target.x - cur.x) < 0.001 && Math.abs(target.y - cur.y) < 0.001;
      raf = settled ? null : requestAnimationFrame(tick);
    };
    const kick = () => {
      if (raf === null && !fxIsLite()) raf = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * 2;
      kick();
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      kick();
    };
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  return { cardRef, rootRef };
}

const NOTICES: Record<string, string> = {
  inactive: "Hesabınız pasif durumda olduğu için oturumunuz kapatıldı. Lütfen yöneticinizle iletişime geçin.",
  no_profile: "Hesabınız henüz yapılandırılmamış. Lütfen ajansla iletişime geçin.",
  auth_callback: "Giriş bağlantısı geçersiz ya da süresi dolmuş. Lütfen tekrar deneyin.",
};

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signInAction, initialState);
  const notice = NOTICES[useSearchParams().get("error") ?? ""] ?? null;
  const router = useRouter();
  const { cardRef, rootRef } = useDepth();
  const formRef = useRef<HTMLFormElement>(null);
  const [leaving, setLeaving] = useState(false);

  // Yanlis parola: kart sallanir (her hatali denemede yeniden).
  useEffect(() => {
    const el = formRef.current;
    if (!state.error || !el) return;
    el.classList.remove("is-shake");
    void el.offsetWidth; // animasyonu bastan oynatmak icin
    el.classList.add("is-shake");
  }, [state]);

  // Basarili giris: panel HEMEN istenir; sunucu cevap verene kadar sahne
  // bulaniklasip cekilir (animasyon bekleme suresinin icinde oynar, ustune
  // eklenmez - eskiden once 750 ms animasyon, SONRA istek vardi). Panel
  // gelince "ilk giris" koreografisi oynar.
  useEffect(() => {
    const next = state.next;
    if (!next) return;
    try {
      window.sessionStorage.setItem("ik:arrive", "1");
    } catch {
      /* sessionStorage kapali olabilir: panel animasyonsuz acilir */
    }
    router.replace(next);
    if (reduceMotion()) return;
    const raf = requestAnimationFrame(() => setLeaving(true));
    return () => cancelAnimationFrame(raf);
  }, [state, router]);

  const busy = isPending || !!state.next;

  return (
    <div ref={rootRef} className={cn("auth", (isPending || !!state.next) && "is-power", leaving && "is-leaving")}>
      <LoginScene />

      <main className="auth-stage">
        <div className="auth-brand">
          <div className="auth-logo-wrap" data-depth="0.5">
            <FlowLogo />
          </div>
          <span className="auth-rule" aria-hidden="true" />
          <p className="auth-kicker">Isı Pompası &amp; İklimlendirme Firmalarının Büyüme Ortağı</p>
        </div>

        <div className="auth-tilt" ref={cardRef}>
          <form ref={formRef} action={formAction} className="auth-card" onAnimationEnd={(e) => e.currentTarget.classList.remove("is-shake")}>
            <h1 className="auth-title">Sektörde büyümenin kontrolü sizde.</h1>

            <label className="auth-field flex flex-col gap-1.5">
              <span className="auth-label">E-posta</span>
              <input type="email" name="email" required autoComplete="email" placeholder="ornek@firma.com" className="ik-input" />
            </label>

            <label className="auth-field flex flex-col gap-1.5">
              <span className="auth-label">Şifre</span>
              <input type="password" name="password" required autoComplete="current-password" placeholder="••••••••" className="ik-input" />
            </label>

            {!state.error && notice ? (
              <p role="status" className="auth-note">
                {notice}
              </p>
            ) : null}

            {state.error ? (
              <p role="alert" className="auth-error">
                {state.error}
              </p>
            ) : null}

            <button type="submit" disabled={busy} className="ik-btn-primary auth-submit mt-1 w-full">
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {state.next ? "Panel açılıyor…" : "Giriş yapılıyor…"}
                </>
              ) : (
                <>
                  Giriş Yap
                  <ArrowRight className="ic h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>

            <p className="auth-foot">Hesabınız yok mu? Firma yönetici hesabınız ajans tarafından oluşturulur.</p>
          </form>
        </div>
      </main>
    </div>
  );
}
