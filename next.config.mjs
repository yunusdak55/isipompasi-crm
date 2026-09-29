// @ts-check
import { execSync } from "node:child_process";

/**
 * Next.js'in resmi "version skew" korumasi (bkz. node_modules/next/dist/docs/
 * .../deploymentId.md, self-hosting.md#version-skew) - bu build'in git commit'i
 * HTML'e/asset URL'lerine gomulur; istemci sayfa GECISI yaparken sunucunun
 * ANLIK deploymentId'siyle uyusmazlik gorurse (ör. arka planda yeni bir deploy
 * oldu) Next.js OTOMATIK OLARAK tam sayfa yenilemesi yapar - client-side
 * routing denemez. Bu SADECE kullanicinin ZATEN gitmek istedigi bir gecis
 * sirasinda tetiklenir (kullanici bir yere tiklamadan spontane olarak
 * calismaz), yani doldurulmakta olan bir formu KESMEZ. Statik dosya
 * (ChunkLoadError) sorunu asil olarak scripts/sync-static-assets.mjs ile
 * (eski chunk'lari public_html'de kalici tutarak) cozuluyor - bu, ONUN
 * yakalayamadigi tek senaryo icin ek guvenlik agi: Server Action/RSC
 * referanslari build'e ozgudur, eski bir sekme hala YUKLU JS'iyle CALISIYOR
 * olsa bile yeni sunucu o referanslari taniyamayabilir - deploymentId bunu
 * bir CRUD formu gonderilmeden ONCE (navigasyon aninda) yakalar.
 */
function getDeploymentId() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return String(Date.now());
  }
}

/**
 * DUZELTME (Hostinger deployment hazirligi): eskiden next.config.TS'ti -
 * Next.js TypeScript config dosyalarini yuklerken once esbuild ile gecici,
 * hash isimli bir JS dosyasina derliyor. esbuild da SWC/Turbopack gibi
 * platforma ozel native bir ikili kullaniyor; Hostinger'in paylasimli
 * Node.js ortaminda eski GLIBC nedeniyle bu adim basarisiz olabiliyor
 * (iklimlen-site projesinde canli olarak dogrulandi - bkz. o projenin git
 * gecmisi). .mjs duz JavaScript oldugu icin Node bunu DOGRUDAN calistirir,
 * hicbir TypeScript-derleme adimi gerekmez. Icerik (ayarlar) BIREBIR AYNI.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  poweredByHeader: false,
  deploymentId: getDeploymentId(),

  // PERF (jet hizi): public/ altindaki gorseller (logo vb.) Next.js varsayilaniyla
  // `max-age=0` geliyordu - tarayici HER sayfa gecisinde yeniden dogruluyordu.
  // 1 gun taze + 7 gun "eskiyi goster, arkada yenile" - tekrar ziyaretlerde
  // sifir ag istegi. (/_next/static zaten Next tarafindan `immutable`.)
  async headers() {
    return [
      {
        source: "/:all*(png|jpg|jpeg|svg|webp|ico|gif)",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      // GUVENLIK: tum yanitlara sabit guvenlik basliklari. (Content-Security-Policy
      // istek basina NONCE gerektirdigi icin src/proxy.ts'te uretilir.)
      {
        source: "/:path*",
        headers: [
          // MIME turu koklemeyi kapat (yuklenen icerigin script sanilmasi).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Clickjacking: iframe icinde acilamaz (CSP frame-ancestors'in eski tarayici karsiligi).
          { key: "X-Frame-Options", value: "DENY" },
          // Baska sitelere giderken tam URL/yol sizmasin.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Kullanilmayan tarayici ozelliklerini kapat.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), interest-cohort=()" },
          // HTTPS'i 1 yil zorunlu kil (yalnizca https uzerinden gelen yanitlarda tarayici uygular).
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        ],
      },
    ];
  },

  // İleride resim domainleri (ör. teklif/kesif fotoğrafları), redirect
  // ve rewrite kuralları gerektiğinde buraya eklenecek.

  // DUZELTME (login "Internal Server Error"): Next.js, CSRF korumasi olarak
  // her Server Action (ör. giris formu) istegindeki Origin/X-Forwarded-Host
  // basligini uygulamanin KENDI bildigi host ile karsilastirir, uyusmuyorsa
  // istegi tamamen reddeder. Hostinger'in reverse proxy'si isteği
  // panel.iklimlen.com'dan alip uygulamaya DAHILI/farkli bir host ile
  // yonlendiriyor - bu yuzden sayfa yuklemeleri (GET, kontrol yok) sorunsuzdu
  // ama giris formunu (POST, Server Action) gonderince anlik 500 aliniyordu.
  // Genel sayfa erisimini/gorunmez bir aciligi ETKILEMEZ - sadece disaridan
  // gelen bu TEK, gercek adresi ("guvenilir" olarak) tanimliyoruz.
  // DUZELTME (canli denetimde yakalanan gercek hata): Dashboard sayaclari
  // sidebar'dan tekrar tiklandiginda eski/"0" deger gosterebiliyordu (kok
  // neden ve asil duzeltme: sidebar.tsx'teki prefetch={false} - bkz. o
  // dosyadaki aciklama). Bu ayar ek bir guvenlik agi: bu uygulamadaki HICBIR
  // sayfa oturuma/role/firmaya bagli olmadan gercekten "onbelleklenebilir"
  // olamayacagi icin istemci route onbellegini (Client Router Cache) TUM
  // uygulama icin de kapatir.
  experimental: {
    serverActions: {
      allowedOrigins: ["panel.iklimlen.com"],
    },
    // DUZELTME (next dev başlangıç uyarısı: "Number must be greater than or
    // equal to 30 at experimental.staleTimes.static") - bu Next.js sürümü artık
    // 0'a izin vermiyor, izin verilen en düşük değer (30s) buraya alındı; niyet
    // (client router cache'i pratikte etkisiz kılmak) korunuyor.
    staleTimes: {
      dynamic: 0,
      static: 30,
    },
  },

  // KOK SEBEP (2026-09-30 canli tekrar-uretim - bkz. lib/chunk-load-recovery.ts):
  // webpack'in varsayilan chunk yukleme zaman asimi 120 SANIYE. Bir deploy
  // sonrasi, eski build'i hala acik tutan bir sekme yeni bir sayfaya gecmeye
  // calisirsa artik sunucuda olmayan bir JS parcasini indirmeye calisir - bu
  // "donma" olarak hissedilen bekleme suresinin ASIL kaynagi (canli testte tam
  // 121 saniye olcduk). recoverFromChunkLoadError zaten hatayi otomatik sayfa
  // yenilemesiyle toparliyor - bu sure kisaltilinca o toparlanma cok daha
  // hizli devreye girer.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.output.chunkLoadTimeout = 10_000;
    }
    return config;
  },
};

export default nextConfig;
