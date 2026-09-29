/**
 * DUZELTME (performans denetimi 2026-09-29, kanit: "site/Satış Görüşmeleri
 * donuyor" sikayeti + canli sitede tekrarlanan, kodda/veride ASLA
 * uretilemeyen (yerelde ayni veritabanina karsi HER sayfa 93-368ms,
 * curl ile sunucu 64-168ms) 300+ saniyelik askida kalma). KOK SEBEP:
 * Supabase istemcileri (`@supabase/ssr` / `@supabase/supabase-js`) HICBIR
 * zaman asimi OLMADAN ciplak `fetch()` kullanir - Hostinger<->Supabase
 * arasinda TEK bir ag isteginin (JWT/JWKS dogrulama, PostgREST sorgusu, ne
 * olursa) gecici bir kesintiye ugramasi durumunda istek SONSUZA KADAR
 * askida kalir, sayfa/action hic yanit vermez ("donma"). Bu, next.config.mjs'te
 * belgelenmis "Hostinger'in reverse proxy'si host basligini tutarsiz
 * yonlendiriyor" gecmisiyle de tutarli - bu hosting katmaninin ara sira
 * ag/proxy sapmalari yasadigi zaten kanitlanmis.
 *
 * COZUM: butun Supabase istemcilerine (server.ts, admin.ts, proxy.ts) bu
 * zaman-asimli fetch'i veriyoruz. Bir istek bu sureyi asarsa AbortError ile
 * BASARISIZ olur - Supabase SDK'si bunu (throw etmek yerine) normal
 * `{ data: null, error }` seklinde dondurur, uygulamadaki HER data-fetching
 * fonksiyonu zaten bu `error` durumunu ele alip (bos liste/durustce hata
 * mesaji ile) GERI DONUYOR - yani bu degisiklik is mantigini degistirmez,
 * sadece "sonsuza kadar donma"yi "hizli ve anlasilir hata"ya cevirir.
 */
const SUPABASE_FETCH_TIMEOUT_MS = 10_000;

export function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS) });
}
