/**
 * GECICI TANI ARACI (2026-09-30, "sayfa geçişlerinde 1sn gecikme" bildirimi -
 * kullanicinin kendi talimati: "kök neden kanıtlanmadan optimizasyon yapma").
 * src/components/perf/navigation-timing.tsx TARAYICIDA olculen, tek bir
 * ic-navigasyonun (Link tiklama -> RSC istegi -> render -> boyanma) fazlara
 * ayrilmis suresini buraya POST eder - kullanicinin kendi cihazinda gorulen
 * gecikmeyi, konsoluna bakmaya gerek kalmadan, dogrudan Hostinger calisma
 * zamani gunluklerinde (bu proje zaten oraya loglayan [PERF] sistemine sahip)
 * okuyabilmek icin. Hicbir kisisel veri/URL parametresi/sorgu icermez -
 * sadece yol adi (pathname) + milisaniye sureleri.
 *
 * Arastirma bitince bu dosya + navigation-timing.tsx guvenle silinebilir.
 */
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const body = JSON.parse(raw) as {
      path?: string;
      clickToRscStartMs?: number | null;
      rscTtfbMs?: number | null;
      rscDownloadMs?: number | null;
      renderCommitMs?: number | null;
      paintSettleMs?: number | null;
      totalMs?: number | null;
      longTaskCount?: number;
      longTaskMs?: number;
      wasHidden?: boolean;
    };

    const parts = [
      `[PERF-CLIENT-NAV]`,
      `path=${body.path ?? "?"}`,
      `click_to_rsc=${body.clickToRscStartMs ?? "?"}ms`,
      `rsc_ttfb=${body.rscTtfbMs ?? "?"}ms`,
      `rsc_download=${body.rscDownloadMs ?? "?"}ms`,
      `render_commit=${body.renderCommitMs ?? "?"}ms`,
      `paint_settle=${body.paintSettleMs ?? "?"}ms`,
      `total=${body.totalMs ?? "?"}ms`,
      `longtasks=${body.longTaskCount ?? 0}(${body.longTaskMs ?? 0}ms)`,
      `was_hidden=${body.wasHidden ? "true(OLCUM_GUVENILMEZ)" : "false"}`,
    ];
    const line = parts.join(" ");
    if ((body.totalMs ?? 0) >= 1000) {
      console.warn(line);
    } else {
      console.log(line);
    }
  } catch {
    // Tani verisi - hicbir zaman istek akisini bozmamali.
  }
  return new Response(null, { status: 204 });
}
