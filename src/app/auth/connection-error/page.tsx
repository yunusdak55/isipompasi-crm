import { WifiOff } from "lucide-react";

/**
 * DUZELTME (canli kanit 2026-09-30, bkz. lib/auth/session.ts,
 * lib/supabase/with-timeout.ts): requireProfile() oturum dogrulamasi
 * (Hostinger<->Supabase ag tikanikligi yuzunden) sert ust sinira
 * (SESSION_CHECK_TIMEOUT_MS) takilirsa buraya yonlendirir.
 *
 * KASITLI OLARAK hicbir Supabase cagrisi YAPMAZ - /auth/inactive gibi
 * KENDI getClaims()/profil sorgusunu yapan bir rotaya yonlendirseydik,
 * AYNI ag tikanikligina yeniden yakalanip sorunu cozmek yerine tekrar
 * eder, hatta requireProfile'daki sinirlamayi bosa cikarirdi. Bu yuzden
 * TAMAMEN statik: her zaman, ag durumu ne olursa olsun, aninda yuklenir.
 */
export default function ConnectionErrorPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-900 to-brand-950 px-4">
      <div className="relative flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-line bg-surface p-8 text-center shadow-elevated-lg">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-500/10 text-warning-600">
          <WifiOff className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Bağlantı sorunu</h1>
          <p className="mt-1.5 text-sm text-ink-500">
            Oturumunuz şu anda doğrulanamadı — bu genellikle geçici bir ağ sorunudur, hesabınızla ilgili bir sorun değildir.
            Birkaç saniye sonra tekrar deneyin.
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- KASITLI: next/link'in
            istemci-tarafi router'i yerine TAM sayfa yenilemesi istiyoruz, boylece onceki
            (askida kalmis) client router durumundan hicbir sey tasinmaz, tamamen taze bir deneme olur. */}
        <a
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-flame-hot via-accent-500 to-flame-ember px-3.5 py-2 text-sm font-medium text-white shadow-glow-accent transition-all duration-150 ease-snappy hover:-translate-y-px active:scale-[0.97]"
        >
          Tekrar Dene
        </a>
      </div>
    </div>
  );
}
