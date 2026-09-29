import { logPerf, parseSupabaseUrl } from "@/lib/perf-log";

/**
 * DUZELTME (performans denetimi 2026-09-29, kanit: "site/Satış Görüşmeleri
 * donuyor" sikayeti + canli sitede tekrarlanan, kodda/veride ASLA
 * uretilemeyen (yerelde ayni veritabanina karsi HER sayfa 93-368ms,
 * curl ile sunucu 64-168ms) uzun askida kalma). KOK SEBEP: Supabase
 * istemcileri (`@supabase/ssr` / `@supabase/supabase-js`) HICBIR zaman
 * asimi OLMADAN ciplak `fetch()` kullanir - Hostinger<->Supabase arasinda
 * TEK bir ag isteginin (JWT/JWKS dogrulama, PostgREST sorgusu, ne olursa)
 * gecici bir kesintiye ugramasi durumunda istek SONSUZA KADAR askida
 * kalabilir, sayfa/action hic yanit vermez ("donma").
 *
 * 3. TUR (gozlemlenebilirlik): bu, kod tabanindaki TEK Supabase-fetch
 * gecis noktasi - proxy.ts, lib/supabase/server.ts, lib/supabase/admin.ts
 * hepsi buradan geciyor. Bu yuzden HER Supabase HTTP cagrisinin (auth,
 * REST, RPC) suresini + sonucunu (basarili/zaman-asimi/hata) TEK bir yerden
 * loglamak icin ideal nokta. `requestId` verilirse (bkz. proxy.ts/server.ts)
 * ayni sayfa yuklemesindeki tum cagrilar Hostinger loglarinda
 * `[PERF][xxxxxxxx]` etiketiyle birbirine baglanabilir. Ham sorgu/filtre
 * verisi ASLA loglanmaz - sadece tablo adi + sure + sonuc (bkz. perf-log.ts).
 */
const SUPABASE_FETCH_TIMEOUT_MS = 10_000;

/**
 * `requestId` middleware'de uretilip `x-request-id` header'i ile sayfa
 * render'ina tasinir (proxy.ts) - server.ts/admin.ts bunu `next/headers`
 * ile okuyup buraya verir. Middleware'in KENDI client'i (proxy.ts) requestId'yi
 * zaten yerel degiskenden bildigi icin dogrudan verir, header okumaya
 * gerek yoktur.
 */
export function buildInstrumentedFetch(requestId: string | undefined): typeof fetch {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? "GET";
    const { op, table } = parseSupabaseUrl(url, method);
    const start = Date.now();

    try {
      const res = await fetch(input, { ...init, signal: AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS) });
      logPerf({
        requestId,
        layer: "supabase",
        op,
        table,
        durationMs: Date.now() - start,
        result: res.ok ? "success" : `http_${res.status}`,
      });
      return res;
    } catch (e) {
      const isTimeout = e instanceof Error && e.name === "TimeoutError";
      logPerf({ requestId, layer: "supabase", op, table, durationMs: Date.now() - start, result: isTimeout ? "timeout" : "error" });
      throw e;
    }
  };
}
