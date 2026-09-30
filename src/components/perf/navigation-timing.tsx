"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * GECICI TANI ARACI (2026-09-30, bkz. app/api/client-perf/route.ts'teki ayni
 * gerekce). Kullanicinin talebi: "sayfa geçişlerinde hissedilen gecikmenin
 * GERCEK tarayici suresini olç - navigation start, RSC request, JS
 * execution, hydration, paint, interactive olma zamanlarini AYRI AYRI".
 *
 * Next.js App Router'da sayfa-arasi (aynı layout altinda) bir gecis TAM SAYFA
 * navigasyonu DEGIL - tarayicinin Navigation Timing/paint API'leri (FCP vb.)
 * bunun icin YENI kayit uretmez, SADECE ilk tam yuklemede calisir. Bu yuzden
 * asagidaki fazlar, standart Performance API birincil verilerinden (Resource
 * Timing = RSC fetch'inin gercek ag fazlari, Long Task API = ana is
 * parcacigini bloke eden JS) MANUEL olarak olculuyor:
 *
 *   [click] --clickToRsc--> [RSC istegi baslar] --ttfb--> [ilk bayt]
 *     --download--> [RSC yaniti tamamlandi] --renderCommit-->
 *     [React yeni agaci DOM'a yazdi (pathname degisti)] --paintSettle-->
 *     [tarayici 2 frame sonra boyayip sakinlesti = "interactive" vekili]
 *
 * Hicbir mevcut davranisi DEGISTIRMEZ - sadece OKUR/olcer. Arastirma bitince
 * bu dosya + api/client-perf/route.ts + layout.tsx'teki tek import/JSX
 * satiri guvenle silinebilir.
 */
type Pending = {
  path: string;
  clickAt: number;
  rscRequestStart?: number;
  rscTtfb?: number;
  rscDownloadEnd?: number;
};

export function NavigationTiming() {
  const pathname = usePathname();
  const pending = useRef<Pending | null>(null);
  const longTaskMs = useRef(0);
  const longTaskCount = useRef(0);

  // Ic navigasyon linklerine tiklamayi yakala - T0 (his edilen gecikmenin
  // baslangici tam olarak burasi).
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(link.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      pending.current = { path: url.pathname, clickAt: performance.now() };
      longTaskMs.current = 0;
      longTaskCount.current = 0;
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // RSC istegini (Next.js'in sayfa gecisi icin attigi fetch) Resource Timing
  // uzerinden yakala - ag fazlarinin (istek->ilk bayt->indirme) TEK dogru kaynagi.
  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;
    const obs = new PerformanceObserver((list) => {
      const p = pending.current;
      if (!p || p.rscRequestStart != null) return;
      for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
        if (entry.initiatorType !== "fetch") continue;
        let entryUrl: URL;
        try {
          entryUrl = new URL(entry.name);
        } catch {
          continue;
        }
        if (entryUrl.pathname !== p.path || entry.startTime < p.clickAt - 50) continue;
        p.rscRequestStart = entry.requestStart || entry.startTime;
        p.rscTtfb = entry.responseStart;
        p.rscDownloadEnd = entry.responseEnd;
        break;
      }
    });
    obs.observe({ type: "resource", buffered: false });
    return () => obs.disconnect();
  }, []);

  // Ana is parcacigini bloke eden JS (hydration/reconciliation dahil) - "JS
  // execution" fazinin kaniti.
  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;
    try {
      const obs = new PerformanceObserver((list) => {
        if (!pending.current) return;
        for (const entry of list.getEntries()) {
          longTaskMs.current += entry.duration;
          longTaskCount.current += 1;
        }
      });
      obs.observe({ type: "longtask", buffered: false });
      return () => obs.disconnect();
    } catch {
      // longtask API bu tarayicida yok - sessizce yoksay.
    }
  }, []);

  // pathname degisti = React yeni agaci COMMIT etti (render+hydration
  // tamamlandi). 2 art arda rAF, tarayicinin GERCEKTEN boyayip bosa cikma
  // (interactive) anini yakalamak icin standart teknik.
  useEffect(() => {
    const p = pending.current;
    if (!p || p.path !== pathname) return;
    const domCommitAt = performance.now();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const interactiveAt = performance.now();
        const payload = {
          path: pathname,
          clickToRscStartMs: p.rscRequestStart != null ? Math.round(p.rscRequestStart - p.clickAt) : null,
          rscTtfbMs: p.rscRequestStart != null && p.rscTtfb != null ? Math.round(p.rscTtfb - p.rscRequestStart) : null,
          rscDownloadMs: p.rscTtfb != null && p.rscDownloadEnd != null ? Math.round(p.rscDownloadEnd - p.rscTtfb) : null,
          renderCommitMs: p.rscDownloadEnd != null ? Math.round(domCommitAt - p.rscDownloadEnd) : null,
          paintSettleMs: Math.round(interactiveAt - domCommitAt),
          totalMs: Math.round(interactiveAt - p.clickAt),
          longTaskCount: longTaskCount.current,
          longTaskMs: Math.round(longTaskMs.current),
        };
        pending.current = null;
        const body = JSON.stringify(payload);
        if (!navigator.sendBeacon?.("/api/client-perf", body)) {
          fetch("/api/client-perf", { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
        }
        // Kendi konsolunda da aninda gorunsun (Hostinger logunu beklemeden).
        console.log("[NAV-TIMING]", payload);
      });
    });
  }, [pathname]);

  return null;
}
