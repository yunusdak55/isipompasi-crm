"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarClock, Sparkles } from "lucide-react";
import { TodayHero } from "@/components/dashboard/today-hero";
import { TaskSection } from "@/components/dashboard/task-section";
import { PipelineCard } from "@/components/dashboard/pipeline-card";
import { buildTodayView, formatClock, formatTodayLabel, greetingFor } from "@/components/dashboard/view-model";
import type { DashboardToday } from "@/lib/data/dashboard";

/** Sayfa aciksa ve gorunurse bu aralikla veritabanindan yeniden okunur. */
const AUTO_REFRESH_MS = 60_000;
/** Sekme yeniden odaklaninca, son okumanin uzerinden bu kadar gectiyse yenile. */
const STALE_AFTER_MS = 15_000;
const STORAGE_KEY = "dashboard:renderedAt";

type Snapshot = { today: DashboardToday; now: number };

/**
 * Dashboard govdesi + OTOMATIK YENILEME. Rakamlarin her zaman GERCEK ve GUNCEL
 * olmasi icin:
 *  - sayfa acik ve gorunurken dakikada bir sunucudan yeniden okur,
 *  - sekmeye / pencereye geri donuldugunde (15 sn'den eski ise) hemen yeniler,
 *  - tarayicinin Geri/Ileri dugmesiyle onbellekten (eski anlik goruntu) donuldugunde
 *    hemen yeniler: ayni `now` degerini bu oturumda daha once gormusse sayfa
 *    onbellekten geri yuklenmistir (istemci saatinden bagimsiz bir tespit),
 *  - damgaya tiklayinca elle yenilenir.
 *
 * KOK NEDEN DUZELTMESI (canli olcum 2026-10-05, bkz. docs/performans-raporu-2026-10-05.md):
 * yenileme eskiden `router.refresh()` idi. O, yalnizca veriyi degil TUM
 * layout'u yeniden render ediyor, istemcinin prefetch onbellegini gecersiz
 * kiliyor ve gorunen her linki yeniden prefetch ettiriyordu - sekmeye donup
 * hemen bir menuye tiklayan kullanici tam bu firtinanin icine dusuyordu.
 * Simdi veri /api/dashboard-today'den TEK istekle okunur; router'a dokunulmaz.
 * Damgadaki saat SUNUCUDA uretilir: "bu rakamlar su saatte veritabanindan okundu".
 */
export function DashboardLive({ initial, firstName }: { initial: Snapshot; firstName: string | null }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [pending, setPending] = useState(false);
  const lastRefreshRef = useRef(0);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    // Gorunmeyen sekme yenilenmez; onceki yenileme bitmeden yenisi baslatilmaz.
    if (document.visibilityState !== "visible" || inFlightRef.current) return;
    inFlightRef.current = true;
    lastRefreshRef.current = Date.now();
    setPending(true);
    try {
      const res = await fetch("/api/dashboard-today", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      const isJson = res.headers.get("content-type")?.includes("application/json") ?? false;
      // Oturum bittiyse proxy /login'e yonlendirir (HTML doner) ya da uc 401 verir:
      // tam sayfa yenilemesi kullaniciyi dogru yere (giris ekrani) goturur.
      if (res.status === 401 || res.redirected || !isJson) {
        window.location.reload();
        return;
      }
      if (res.ok) setSnapshot((await res.json()) as Snapshot);
      // 503 / gecici hata: eldeki (son basarili) veri gosterilmeye devam eder.
    } catch {
      // Ag hatasi / zaman asimi: bir sonraki tetikleyici yeniden dener.
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  }, []);

  // Mount: onbellekten geri yukleme tespiti + olay/aralik dinleyicileri.
  useEffect(() => {
    lastRefreshRef.current = Date.now();

    try {
      const seen = window.sessionStorage.getItem(STORAGE_KEY);
      // Ayni sunucu ciktisi daha once gosterilmisti -> Geri/Ileri ile onbellekten geldik.
      // (Effect govdesinde eszamanli setState olmasin diye bir mikro-gorev sonra.)
      if (seen === String(initial.now)) queueMicrotask(() => void refresh());
      window.sessionStorage.setItem(STORAGE_KEY, String(initial.now));
    } catch {
      // sessionStorage kapali olabilir; 60 sn'lik aralik yine yeniler.
    }

    const onWake = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefreshRef.current > STALE_AFTER_MS) void refresh();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void refresh(); // tarayici bfcache'inden donus
    };

    const interval = window.setInterval(() => void refresh(), AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("pageshow", onPageShow);
    };
    // initial.now YALNIZCA mount aninda kiyaslanir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const { today } = snapshot;
  const now = useMemo(() => new Date(snapshot.now), [snapshot.now]);
  const view = useMemo(() => buildTodayView(today, now), [today, now]);

  return (
    <div className="stagger flex flex-col gap-6">
      <TodayHero
        greeting={greetingFor(now)}
        firstName={firstName}
        dateLabel={formatTodayLabel(now)}
        today={today}
        week={view.week}
        timeLabel={formatClock(now.toISOString())}
        refreshing={pending}
        onRefresh={refresh}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-6">
          <TaskSection
            id="bugun"
            title="Bugünkü Takipler"
            icon={<CalendarClock className="h-4 w-4" />}
            tone="accent"
            count={today.counts.due}
            countLabel={today.counts.dueCarry > 0 ? `saat sırasıyla · ${today.counts.dueCarry} tanesi dünden kaldı` : "saat sırasıyla"}
            items={view.due}
            agenda
            moreHref="/leads/followups"
            moreLabel="Takipte'de gör"
            remaining={today.counts.due - view.due.length}
            emptyTitle="Bugün için planlı takip yok"
            emptyBody="Bir müşteriye takip tarihi verdiğinizde, saat sırasıyla burada görünür."
          />

          <TaskSection
            id="yeni"
            title="Yeni Gelenler"
            icon={<Sparkles className="h-4 w-4" />}
            tone="success"
            count={today.counts.fresh}
            countLabel="son 24 saat"
            items={view.fresh}
            moreHref="/leads"
            moreLabel="Leadler'de gör"
            remaining={today.counts.fresh - view.fresh.length}
            emptyTitle="Yeni lead yok"
            emptyBody="Son 24 saatte yeni bir müşteri gelmedi."
          />
        </div>

        <div className="flex flex-col gap-6">
          <TaskSection
            id="geciken"
            title="Geciken Takipler"
            icon={<AlertTriangle className="h-4 w-4" />}
            tone="danger"
            count={today.counts.overdue}
            countLabel="en az geciken önce"
            items={view.overdue}
            moreHref="/leads/overdue"
            moreLabel="Gecikenler'de gör"
            remaining={today.counts.overdue - view.overdue.length}
            emptyTitle="Geciken takip yok"
            emptyBody="Takibe aldığınız hiçbir müşterinin tarihi 24 saatten fazla geçmemiş."
          />

          <PipelineCard today={today} />
        </div>
      </div>
    </div>
  );
}
