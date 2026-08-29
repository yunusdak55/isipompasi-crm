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
};

export default nextConfig;
