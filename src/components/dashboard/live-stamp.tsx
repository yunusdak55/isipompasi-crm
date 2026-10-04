"use client";

import { useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/** Sayfa aciksa ve gorunurse bu aralikla veritabanindan yeniden okunur. */
const AUTO_REFRESH_MS = 60_000;
/** Sekme yeniden odaklaninca, son okumanin uzerinden bu kadar gectiyse yenile. */
const STALE_AFTER_MS = 15_000;
const STORAGE_KEY = "dashboard:renderedAt";

/**
 * "17:42 itibarıyla" damgasi + OTOMATIK YENILEME. Dashboard'daki rakamlarin
 * her zaman GERCEK ve GUNCEL olmasi icin:
 *  - sayfa acik ve gorunurken dakikada bir sunucudan yeniden okur (router.refresh:
 *    yalnizca veri yenilenir, kaydirma konumu/acik paneller bozulmaz),
 *  - sekmeye / pencereye geri donuldugunde (15 sn'den eski ise) hemen yeniler,
 *  - tarayicinin Geri/Ileri dugmesiyle onbellekten (eski anlik goruntu) donuldugunde
 *    hemen yeniler: ayni `renderedAt` degerini bu oturumda daha once gormusse sayfa
 *    onbellekten geri yuklenmistir (istemci saatinden bagimsiz bir tespit),
 *  - damgaya tiklayinca elle yenilenir.
 * Damgadaki saat SUNUCUDA uretilir: "bu rakamlar su saatte veritabanindan okundu".
 */
export function LiveStamp({ renderedAt, timeLabel }: { renderedAt: number; timeLabel: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const lastRefreshRef = useRef(0);
  const inFlightRef = useRef(false);

  const refresh = useCallback(() => {
    // Gorunmeyen sekme yenilenmez; onceki yenileme bitmeden yenisi baslatilmaz
    // (art arda tiklama / ust uste binen tetikleyiciler sunucuyu yormasin).
    if (document.visibilityState !== "visible" || inFlightRef.current) return;
    inFlightRef.current = true;
    lastRefreshRef.current = Date.now();
    startTransition(() => router.refresh());
    // Guvenlik agi: pending durumu hic degismese bile kilit sonsuza dek kalmasin.
    window.setTimeout(() => {
      inFlightRef.current = false;
    }, 10_000);
  }, [router]);

  // Yenileme tamamlaninca (pending false) bir sonrakine izin ver.
  useEffect(() => {
    if (!pending) inFlightRef.current = false;
  }, [pending]);

  // Mount: onbellekten geri yukleme tespiti + olay/aralik dinleyicileri.
  useEffect(() => {
    lastRefreshRef.current = Date.now();

    try {
      const seen = window.sessionStorage.getItem(STORAGE_KEY);
      if (seen === String(renderedAt)) {
        // Ayni sunucu cikti daha once gosterilmisti -> Geri/Ileri ile onbellekten geldik.
        refresh();
      }
    } catch {
      // sessionStorage kapali olabilir; 60 sn'lik aralik yine yeniler.
    }

    const onWake = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefreshRef.current > STALE_AFTER_MS) refresh();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) refresh(); // tarayici bfcache'inden donus
    };

    const interval = window.setInterval(refresh, AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("pageshow", onPageShow);
    };
    // renderedAt YALNIZCA mount aninda kiyaslanir; sonraki yenilemelerde dinleyiciler yeniden kurulmaz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  // Her yeni sunucu ciktisinda "bunu gosterdim" diye kaydet (Geri/Ileri tespiti icin).
  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, String(renderedAt));
    } catch {
      // yoksay
    }
  }, [renderedAt]);

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={pending}
      title={`Rakamlar veritabanından ${timeLabel} itibarıyla okundu. Sayfa açıkken dakikada bir kendiliğinden yenilenir; tıklayarak şimdi yenileyebilirsiniz.`}
      className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-white/60 transition-colors duration-150 hover:border-white/25 hover:bg-white/10 hover:text-white disabled:cursor-default"
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-500/60 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success-500" />
      </span>
      <span className="tabular-nums">{timeLabel}</span>
      <span className="hidden sm:inline">itibarıyla güncel</span>
      <RefreshCw className={cn("h-3 w-3 text-white/40 transition-colors group-hover:text-white/80", pending && "animate-spin")} />
    </button>
  );
}
