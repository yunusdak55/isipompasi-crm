// @ts-check

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
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
};

export default nextConfig;
