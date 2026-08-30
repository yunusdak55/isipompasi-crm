/**
 * DUZELTME (giris formu "Internal Server Error" / calismiyor): login/page.tsx
 * "use client" oldugu ve hic sunucu verisi cekmedigi icin Next.js bu sayfayi
 * TAMAMEN STATIK (tek seferlik, 1 yillik "Cache-Control: s-maxage=31536000")
 * insa ediyordu. Hostinger'in CDN'i (hcdn) bu onbellegi HTTP METODUNU
 * gormezden gelip POST (giris formu = Server Action) isteklerine bile ayni
 * onbellegi donduruyordu - yani "Giriş Yap" tiklamasi cogu zaman gercek
 * sunucuya HIC ULASMIYORDU (canli test: bir POST istegi "x-nextjs-cache: HIT"
 * donduruyordu). "use client" dosyasina dogrudan route-segment config
 * eklenemedigi icin (Next.js kurali) bu ayri, ince sunucu bilesenli layout
 * ekleniyor - SADECE /login rotasini dinamik isaretler, uygulamanin geri
 * kalanina dokunmaz.
 */
export const dynamic = "force-dynamic";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
