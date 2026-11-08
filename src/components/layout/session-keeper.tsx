"use client";

import { useEffect } from "react";

/** Oturum dolmadan bu kadar once yenilenir (SDK son 90 sn icinde yeniler). */
const LEAD_MS = 60_000;
const RETRY_MS = 60_000;

/**
 * HIZ (2026-11-08, canli kayit: oturum yenileme Supabase'de ~1 sn): erisim
 * jetonu 1 saatte bir dolar ve eskiden yenileme, kullanicinin o anki
 * TIKLAMASININ icinde (proxy'de, sayfadan once) yapiliyordu - tiklama basina
 * +1 sn. Bu bilesen sekme acikken yenilemeyi arka planda, jeton dolmadan
 * hemen once yapar: hafif bir istek proxy'den gecer, proxy jetonu yeniler,
 * yeni cerezler tarayiciya yazilir. Sekmeye uzun aradan sonra donulunce
 * (uyku, baska sekme) jeton dolmussa ilk tiklamadan once hemen yenilenir.
 * Gorunur bir sey cizmez.
 */
export function SessionKeeper({ expiresIn }: { expiresIn: number | null }) {
  useEffect(() => {
    if (expiresIn === null) return;
    let deadline = Date.now() + expiresIn * 1000;
    let timer: number | undefined;
    let busy = false;
    let stopped = false;

    const schedule = (wait: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void ping(), Math.max(0, wait));
    };

    const ping = async () => {
      if (busy || stopped) return;
      busy = true;
      try {
        const res = await fetch("/api/session-ping", { cache: "no-store", redirect: "manual", credentials: "same-origin" });
        // Giris sayfasina yonlendirildi: oturum yok, ugrasacak bir sey kalmadi.
        if (res.type === "opaqueredirect" || res.status === 401) {
          stopped = true;
          return;
        }
        const body = res.ok ? ((await res.json()) as { expiresIn?: unknown }) : null;
        if (body && typeof body.expiresIn === "number" && body.expiresIn * 1000 > LEAD_MS) {
          deadline = Date.now() + body.expiresIn * 1000;
          schedule(deadline - LEAD_MS - Date.now());
        } else {
          schedule(RETRY_MS);
        }
      } catch {
        schedule(RETRY_MS); // ag yok / gecici hata: bir dakika sonra tekrar
      } finally {
        busy = false;
      }
    };

    // Uyku, sekme degisimi, internetin geri gelmesi: zamanlayici kacmis olabilir.
    const onWake = () => {
      if (document.visibilityState === "visible" && Date.now() > deadline - LEAD_MS - 30_000) void ping();
    };

    schedule(deadline - LEAD_MS - Date.now());
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [expiresIn]);

  return null;
}
