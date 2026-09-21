/**
 * Genel amacli sayfa yukleme iskeleti (spec: "site kasiyor" - kok neden
 * analizinin bir parcasi). Bu uygulamada `staleTimes: {dynamic:0, static:0}`
 * bilincli olarak TUM istemci route onbellegini kapatiyor (next.config.mjs -
 * cok kiracili/role bagimli veri guvenligi icin) - yani HER navigasyon
 * gercek bir sunucu gidis-donusu gerektiriyor. Bir `loading.tsx` OLMADAN bu
 * sure boyunca ekran donuk/tepkisiz gorunuyor (kullaniciya "kasiyor" gibi
 * geliyor), oysa Next.js bu bekleme suresince Suspense fallback'i ANINDA
 * gosterebiliyor. Bircok route'ta loading.tsx eksikti - bu paylasilan
 * iskelet, o eksik route'lara hizlica, tutarli bir "aninda tepki" katmani
 * ekler (ozel/el yapimi iskeletler - dashboard, lead detay, settings -
 * zaten vardi, onlara dokunulmadi).
 */
export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-6 shadow-elevated-lg sm:p-7">
        <div className="skeleton h-7 w-48 rounded-lg bg-white/10" />
        <div className="skeleton mt-2 h-4 w-72 rounded-lg bg-white/10" />
      </div>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface px-5 py-4">
            <div className="skeleton h-3 w-16 rounded" />
            <div className="skeleton mt-3 h-6 w-12 rounded" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-col gap-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="skeleton h-11 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Form/detay agirlikli sayfalar (yeni kayit, duzenleme) icin daha sade iskelet. */
export function FormSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="skeleton h-4 w-28 rounded" />
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="skeleton h-6 w-48 rounded" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="skeleton h-3 w-20 rounded" />
              <div className="skeleton h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
