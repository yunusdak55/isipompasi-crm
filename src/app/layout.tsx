import type { Metadata } from "next";
import { connection } from "next/server";
import { Inter } from "next/font/google";
import { BrowserPerfTiming } from "@/components/perf/browser-timing";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"], // latin-ext: Turkce (ş ğ ı ö ü ç) karakterleri icerir
  variable: "--font-inter",
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
    <html lang="tr" className={inter.variable}>
      <body>
        <BrowserPerfTiming />
        {children}
      </body>
    </html>
  );
}
