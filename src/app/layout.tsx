import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"], // latin-ext: Turkce (ş ğ ı ö ü ç) karakterleri icerir
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "İklimlen",
  description: "Isı pompası ve iklimlendirme firmalarının büyüme ortağı.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
