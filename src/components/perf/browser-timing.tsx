"use client";

import { useEffect } from "react";

/**
 * GOZLEMLENEBILIRLIK (tarayici tarafi, bkz. lib/perf-log.ts'teki sunucu
 * tarafi karsiligi). Amac: "sunucu tarafinda her sey normal gorunmus
 * olabilir - o zaman sorun Supabase/Node degil, tarayici/ag katmaninda
 * olabilir" teshisini KANITLA yapabilmek. TARAYICI KONSOLUNA yazar (sunucu
 * loglarina DEGIL - bu istemci kodudur, DevTools > Console'da goruntulenir).
 *
 * Gecici/kolayca kaldirilabilir tani araci: bu dosyayi silip app/layout.tsx'teki
 * tek import + tek JSX satirini kaldirmak yeterli. Kisisel veri/istek govdesi
 * ICERMEZ - sadece tarayicinin kendi Performance API zaman damgalari.
 */
export function BrowserPerfTiming() {
  useEffect(() => {
    if (typeof window === "undefined" || !("performance" in window)) return;

    const hydratedAtMs = Math.round(performance.now());
    console.log(`[PERF-CLIENT] hydration tamamlandi (navigasyondan itibaren) ${hydratedAtMs}ms`);

    const logNavigation = () => {
      const [nav] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
      if (!nav) return;
      console.log(
        `[PERF-CLIENT] navigation ttfb=${Math.round(nav.responseStart)}ms ` +
          `domContentLoaded=${Math.round(nav.domContentLoadedEventEnd)}ms load=${Math.round(nav.loadEventEnd)}ms type=${nav.type}`
      );
    };
    if (document.readyState === "complete") {
      logNavigation();
    } else {
      window.addEventListener("load", logNavigation, { once: true });
    }

    // "longtask": ana is parcacigini (main thread) 50ms+ bloke eden isler -
    // tarayici arayuzunun donmus HISSETTIRDIGI (input/render gecikmesi)
    // asil kanit budur. Tum tarayicilar desteklemez (ör. Firefox) - sessizce yoksayilir.
    let longTaskObserver: PerformanceObserver | undefined;
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.warn(`[PERF-CLIENT] longtask duration=${Math.round(entry.duration)}ms baslangic=${Math.round(entry.startTime)}ms`);
        }
      });
      longTaskObserver.observe({ type: "longtask", buffered: true });
    } catch {
      // PerformanceObserver("longtask") desteklenmiyor - yoksay.
    }

    return () => {
      window.removeEventListener("load", logNavigation);
      longTaskObserver?.disconnect();
    };
  }, []);

  return null;
}
