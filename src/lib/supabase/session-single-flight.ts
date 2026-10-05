/**
 * OTURUM DOGRULAMASINDA "TEK UCUS" (single-flight), surec ici.
 *
 * KOK NEDEN (canli kanit 2026-10-05, bkz. docs/performans-raporu-2026-10-05.md):
 * tarayici ayni anda birden cok istek atar (sayfa + prefetch'ler). Erisim
 * jetonunun suresi dolmaya yakinken (saatte bir) bu isteklerin HEPSI ayni eski
 * cerezle gelir ve proxy'de her biri KENDI token yenilemesini baslatiyordu.
 * Hostinger logu: 14:00:16'da 5, 12:49:40'ta 4 eszamanli `auth_token_refresh`
 * (her biri 440-660 ms; ara katman toplami 500-800 ms) ve bir kez de
 * `http_400` (ayni refresh token'in yarisan kullanimi - oturumu dusurebilir).
 *
 * COZUM: ayni oturum cereziyle gelen eszamanli istekler TEK bir getClaims()
 * (dolayisiyla en fazla TEK yenileme) sonucunu paylasir. Yenileme olduysa
 * sonuc kisa bir sure saklanir: tarayici yeni cerezi almadan yola cikmis
 * "gecikmeli" istekler de eski refresh token'i tekrar kullanmak yerine ayni
 * yeni cerezleri alir.
 *
 * GUVENLIK: anahtar oturum cerezinin TAM degeridir (jetonun kendisi) - baska
 * bir kullanicinin istegi ayni anahtari uretemez, yani sonuc asla kullanicilar
 * arasi paylasilmaz. Yalnizca bellekte, en fazla REUSE_MS kadar tutulur;
 * loglanmaz. Cok surecli calismada surecler arasi paylasilmaz (zararsiz:
 * en kotu ihtimalle eski davranis).
 */

export type SessionCookie = { name: string; value: string; options?: Record<string, unknown> };
export type SessionResult = { claims: { sub?: string } | null; cookiesToSet: SessionCookie[] };

/** Yenilenmis cerezlerin, eski cerezle gelen gecikmeli isteklere verilecegi sure. */
const REUSE_MS = 20_000;

const flights = new Map<string, Promise<SessionResult>>();

/** Istekteki Supabase oturum cerezlerinden (parcali olabilir) deterministik anahtar; oturum yoksa null. */
export function sessionKeyFromCookies(cookies: { name: string; value: string }[]): string | null {
  const parts = cookies
    .filter((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => `${c.name}=${c.value}`);
  return parts.length > 0 ? parts.join(";") : null;
}

/**
 * `key` icin suren (ya da az once yenileme yapmis) bir dogrulama varsa onu,
 * yoksa `run`'i baslatip onu dondurur. `leader`: bu cagri `run`'i kendisi mi baslatti.
 */
export function singleFlightSession(key: string, run: () => Promise<SessionResult>): { promise: Promise<SessionResult>; leader: boolean } {
  const existing = flights.get(key);
  if (existing) return { promise: existing, leader: false };

  const promise = run();
  flights.set(key, promise);
  const forget = () => {
    if (flights.get(key) === promise) flights.delete(key);
  };
  promise.then(
    (result) => {
      // Yenileme olmadiysa saklamaya gerek yok (dogrulama zaten yerel ve ucuz).
      if (result.cookiesToSet.length === 0) forget();
      else setTimeout(forget, REUSE_MS).unref?.();
    },
    forget
  );
  return { promise, leader: true };
}
