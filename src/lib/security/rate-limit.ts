/**
 * Basit, bellek ici (surec basina) kayan-pencere hiz sinirlayici - GIRIS DENEMELERI icin.
 *
 * Neden gerekli: tum giris istekleri Supabase Auth'a UYGULAMA SUNUCUSUNUN tek IP'sinden
 * gider; Supabase'in IP basina limiti bu yuzden kotu niyetli birinin denemeleriyle
 * TUM kullanicilari kilitleyebilir, ayni zamanda hesap/IP bazinda ince bir sinir
 * saglamaz. Buradaki sinir once uygulama katmaninda durdurur.
 *
 * Sinirlama: surec yeniden baslayinca/coklu surecte sayaclar sifirlanir (kabul edilebilir;
 * asil kalici korumalar parola politikasi, Supabase Auth limiti ve RLS'dir).
 */
type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

function prune(bucket: Bucket, windowMs: number, now: number) {
  while (bucket.hits.length && now - bucket.hits[0] > windowMs) bucket.hits.shift();
}

/** Anahtar icin pencere icindeki BASARISIZ deneme sayisi limiti astiysa true. */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const bucket = buckets.get(key);
  if (!bucket) return false;
  prune(bucket, windowMs, Date.now());
  return bucket.hits.length >= limit;
}

/** Basarisiz bir denemeyi kaydeder. */
export function recordFailure(key: string, windowMs: number) {
  const now = Date.now();
  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) {
      prune(b, windowMs, now);
      if (b.hits.length === 0) buckets.delete(k);
    }
    if (buckets.size > MAX_KEYS) buckets.clear();
  }
  const bucket = buckets.get(key) ?? { hits: [] };
  prune(bucket, windowMs, now);
  bucket.hits.push(now);
  buckets.set(key, bucket);
}

export function clearFailures(key: string) {
  buckets.delete(key);
}

/**
 * Istemci IP'si. Guvenilir ters vekilin (Hostinger) eklediginin son deger oldugu
 * varsayilir: `x-real-ip` varsa o, yoksa `x-forwarded-for`'un SON girdisi
 * (ilk girdi istemci tarafindan sahtelenebilir).
 */
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "unknown";
}
