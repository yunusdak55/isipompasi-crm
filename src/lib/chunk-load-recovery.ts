/**
 * KOK SEBEP (2026-09-30 canli tekrar-uretim, kanit: Chrome DevTools console -
 * "ChunkLoadError: Loading chunk 9305 failed (timeout: .../layout-<hash>.js)",
 * hic sunucu isteği/[PERF] logu OLUSMADAN, sadece tarayicida): her yeni deploy
 * (`next build`) route/layout JS dosyalarini YENI icerik-hash'li isimlerle
 * uretir ve ESKI build'in dosyalarini SUNUCUDAN TAMAMEN SILER. Bir sekmede
 * ONCEKI build'in HTML'i/JS'i hala acikken (deploy oldugunda) kullanici bir
 * sayfaya gecmeye calisirsa, tarayici artik var olmayan bir chunk dosyasini
 * indirmeye calisir - bu istek ya 404 ya da zaman asimina ugrar, Next.js bunu
 * ChunkLoadError olarak en yakin error.tsx'e firlatir. Bu, "site donuyor"
 * olarak hissedilir (chunk zaman asimi ~dakikalar surebilir) ve sunucu
 * tarafinda HICBIR iz birakmaz (istek Node.js'e hic ulasmaz, statik dosya
 * sunumunda 404/timeout olur) - onceki gozlemlenebilirlik turunda sunucu
 * loglarinin neden hep temiz cikitigini de aciklar.
 *
 * COZUM: tespit edilince tam sayfa yenileme (GUNCEL build'i indirir).
 */
export function isChunkLoadError(error: Error): boolean {
  return error.name === "ChunkLoadError" || /Loading chunk [\w.-]+ failed|Failed to fetch dynamically imported module/i.test(error.message);
}

const RELOAD_GUARD_KEY = "chunk-load-reload-attempted";

/**
 * Sonsuz yenileme donguisune girmemek icin sekme basina TEK seferlik dener -
 * deploy'dan kaynaklanmayan, KALICI bir hata varsa (ör. gercekten bozuk bir
 * derleme) kullaniciya normal hata ekrani + "Tekrar Dene" gosterilmeye devam eder.
 */
export function recoverFromChunkLoadError(error: Error): boolean {
  if (typeof window === "undefined" || !isChunkLoadError(error)) return false;
  if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return false;
  sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
  window.location.reload();
  return true;
}
