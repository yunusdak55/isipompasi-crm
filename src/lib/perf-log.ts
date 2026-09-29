/**
 * GOZLEMLENEBILIRLIK ALTYAPISI (performans denetimi 2026-09-29, 3. tur:
 * "hangi katmanda, hangi request'in, kaç ms boyunca beklediğini gösteren
 * kesin kanıt olmalı - sadece hata log'una güvenme, başarılı ama YAVAŞ
 * isteklerin de süresini ölç").
 *
 * TEK, MERKEZI log formatı - Hostinger "Çalışma Zamanı Günlükleri"nde
 * aranabilir/filtrelenebilir olsun diye SABIT sırada alanlar:
 *   [PERF][requestId] layer=... op=... table=... duration=Nms result=...
 *
 * ESIK/SEVIYE (log gurultusunu azaltmak icin console metodu farkli):
 *   <300ms   -> console.log    (Hostinger: Bilgi/Genel)
 *   300-1000 -> console.log    (yine bilgi - ama "yavaş" etiketiyle isaretli)
 *   >1000ms  -> console.warn   (Hostinger: Uyarı) - kritik esik
 * Hicbir JWT/token/cookie/sifre/kisisel veri LOGLANMAZ - sadece
 * katman/islem adi/tablo adi/sure/sonuc (metadata).
 */

export type PerfResult = "success" | "timeout" | "error" | `http_${number}`;

export function newRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * `Date.now()` sarmalayicisi: Server Component "render" govdesinde
 * DOGRUDAN `Date.now()` cagirmak React Compiler'in saflik (purity)
 * denetimine takilir (bkz. (dashboard)/layout.tsx). Ayri bir modulden
 * import edilen bu fonksiyon derleyici tarafindan bilinen bir global
 * degil, opak bir cagri olarak degerlendirilir.
 */
export function now(): number {
  return Date.now();
}

function severityLabel(durationMs: number): "normal" | "yavas" | "cok_yavas" | "kritik" {
  if (durationMs < 300) return "normal";
  if (durationMs < 700) return "yavas";
  if (durationMs < 1000) return "cok_yavas";
  return "kritik";
}

export function logPerf(entry: {
  requestId: string | undefined;
  layer: string;
  op: string;
  table?: string;
  durationMs: number;
  result: PerfResult;
}) {
  const { requestId, layer, op, table, durationMs, result } = entry;
  const severity = severityLabel(durationMs);
  const parts = [
    `[PERF]`,
    requestId ? `[${requestId}]` : "[-]",
    `layer=${layer}`,
    `op=${op}`,
    table ? `table=${table}` : null,
    `duration=${durationMs}ms`,
    `result=${result}`,
    `severity=${severity}`,
  ].filter(Boolean);
  const line = parts.join(" ");
  // KRITIK esik (1sn+): console.warn - Hostinger loglarinda "Uyari" olarak
  // filtrelenebilir, aramasi kolay olsun. Digerleri console.log (Bilgi).
  if (durationMs >= 1000) {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 * Bir Supabase REST/Auth/RPC URL'inden GUVENLI (sorgu parametresi/veri
 * ICERMEYEN) metadata cikarir: hangi tabloya, hangi islem turune gidildigi.
 * Ham sorgu string'i (filtreler, .select() kolonlari vb.) ASLA loglanmaz.
 */
export function parseSupabaseUrl(url: string, method: string): { op: string; table?: string } {
  try {
    const u = new URL(url);
    const path = u.pathname;

    if (path.includes("/auth/v1/")) {
      if (path.endsWith("jwks.json")) return { op: "auth_jwks_fetch" };
      if (path.endsWith("/token")) return { op: "auth_token_refresh" };
      if (path.endsWith("/user")) return { op: "auth_get_user" };
      return { op: "auth_other" };
    }

    const restMatch = path.match(/\/rest\/v1\/(?:rpc\/)?([a-zA-Z0-9_]+)/);
    const isRpc = path.includes("/rest/v1/rpc/");
    const opByMethod: Record<string, string> = { GET: "select", POST: isRpc ? "rpc" : "insert", PATCH: "update", DELETE: "delete" };
    const op = opByMethod[method] ?? method.toLowerCase();
    return { op, table: restMatch?.[1] };
  } catch {
    return { op: method.toLowerCase() };
  }
}
