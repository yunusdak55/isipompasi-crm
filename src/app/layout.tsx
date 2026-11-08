import type { Metadata } from "next";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { Inter, Sora } from "next/font/google";
import { FxController } from "@/components/layout/fx-controller";
import { FX_COOKIE, parseFxPref } from "@/lib/fx";
import "./globals.css";
import "./iklim.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"], // latin-ext: Turkce (ş ğ ı ö ü ç) karakterleri icerir
  variable: "--font-inter",
  display: "swap",
});

// iklimlen.com'un baslik fontu: basliklar, buyuk sayilar, marka. Derlemede projeye
// gomulur (next/font kendi sunucusundan servis eder, Google'a istek gitmez).
const sora = Sora({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-sora",
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
  // Kullanici "Hafif" sectiyse sinif ilk boyamada gelir (efektler bir kare bile acilmaz).
  const fx = parseFxPref((await cookies()).get(FX_COOKIE)?.value);
  return (
    <html lang="tr" className={`${inter.variable} ${sora.variable}${fx === "lite" ? " fx-lite" : ""}`} suppressHydrationWarning>
      <body>
        <FxController />
        {children}
      </body>
    </html>
  );
}
