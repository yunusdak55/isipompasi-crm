import type { Metadata } from "next";
import { connection } from "next/server";
import { Instrument_Serif, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"], // latin-ext: Turkce (ş ğ ı ö ü ç) karakterleri icerir
  variable: "--font-inter",
  display: "swap",
});

// Vitrin yazi tipi (Dashboard selamlamasi): editoryal serif, italigi isim vurgusu icin.
// Inter gibi derleme aninda indirilip kendi sunucumuzdan sunulur (CSP: font-src 'self').
const instrumentSerif = Instrument_Serif({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "İklimlen",
  description: "Isı pompası ve iklimlendirme firmalarının büyüme ortağı.",
  // Ozel yonetim paneli: arama motorlari indekslemesin.
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // GUVENLIK: Content-Security-Policy istek basina rastgele bir nonce kullanir
  // (bkz. src/proxy.ts); Next.js nonce'u yalnizca DINAMIK render'da script'lere
  // ekleyebilir. Bu cagri tum sayfalari (login dahil) dinamik yapar - aksi halde
  // derleme aninda uretilen statik sayfalarda nonce olmaz ve CSP script'leri engeller.
  await connection();
  return (
    <html lang="tr" className={`${inter.variable} ${instrumentSerif.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
