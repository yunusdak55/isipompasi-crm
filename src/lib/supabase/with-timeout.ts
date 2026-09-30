/**
 * DUZELTME (canli kanit 2026-09-30: tarayici Performance API'sinde tek bir
 * navigasyon icin ttfb=392516ms - 392 SANIYE - olculdu, neredeyse tam
 * 39 x 10.000ms). KOK SEBEP: fetch-with-timeout.ts'teki 10sn'lik sinir
 * sadece TEK BIR ham fetch cagrisini kapsiyor - ama @supabase/auth-js'in
 * GoTrueClient'i, o fetch zaman asimina ugrayip AuthRetryableFetchError
 * firlattiginda bunu KENDI ICINDE, gorunmez sekilde tekrar dener
 * (bkz. node_modules/@supabase/auth-js/dist/module/GoTrueClient.js
 * `_refreshAccessToken` -> `retryable()`: ussel geri cekilmeyle, TEK bir
 * yenileme denemesi AUTO_REFRESH_TICK_DURATION_MS=30sn'ye kadar tekrar
 * dener). Bir sayfa yuklemesinde oturum dogrulayan HER bagimsiz Supabase
 * istemcisi (middleware + requireProfile + diger sorgular, her biri KENDI
 * createClient() cagrisiyla ayri bir GoTrueClient) bu ~30sn'lik dongüyu
 * BAGIMSIZ tetikleyebiliyor - Hostinger<->Supabase arasi gecici bir ag
 * tikanikligi sirasinda bunlar art arda/UST USTE binerek dakikalarca surebiliyor.
 *
 * Bu sarmalayici, SDK'nin kendi ic tekrar mantigina dokunmadan (riskli,
 * kutuphane guncellemesinde kirilir), CAGIRANIN bekleme suresine sert bir
 * UST SINIR koyar: ic taraftaki is arka planda calismaya devam etse bile
 * (gercek iptal degil, bkz. AbortSignal.timeout'un aksine), cagiran asla
 * bu sureden fazla beklemez. "Oturum dogrulanamadi" = guvenli taraf
 * (login'e yonlendirme) - "oturum var say" DEGIL.
 */
export const SESSION_CHECK_TIMEOUT_MS = 12_000;

export class SessionCheckTimeoutError extends Error {
  constructor(label: string) {
    super(`session check timed out after ${SESSION_CHECK_TIMEOUT_MS}ms: ${label}`);
    this.name = "SessionCheckTimeoutError";
  }
}

export async function withTimeout<T>(promise: Promise<T>, label: string, ms = SESSION_CHECK_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SessionCheckTimeoutError(label)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
