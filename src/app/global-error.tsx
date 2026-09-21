"use client";

import { useEffect } from "react";

/**
 * Kok (root layout) seviyesinde olusan bir hatayi yakalayan son care - normal
 * error.tsx'ler kendi route grubunun ICINDEKI hatalari yakalar ama root
 * layout'un (src/app/layout.tsx) KENDISINDE bir hata olursa devreye giremez;
 * bunun icin Next.js ozel olarak bu dosyayi arar. Kendi <html>/<body>'sini
 * icermek ZORUNDA (root layout'un yerini aliyor). DUZELTME ("bazen hata
 * veriyor" denetimi): bu dosya da hic yoktu - yani en kotu senaryoda (root
 * layout hatasi) kullaniciya tarayicinin kendi bos/teknik hata sayfasi
 * gosteriliyordu.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Root layout error:", error);
  }, [error]);

  return (
    <html lang="tr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "1.5rem",
            textAlign: "center",
            background: "#0b1220",
            color: "#f4f6fb",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Bir şeyler ters gitti</h1>
          <p style={{ maxWidth: 360, color: "#9aa4b8", margin: 0 }}>
            Uygulama beklenmeyen bir hatayla karşılaştı. Sayfayı yeniden yüklemeyi deneyin.
          </p>
          <button
            onClick={() => reset()}
            style={{
              borderRadius: 8,
              border: "none",
              background: "#f4622c",
              color: "white",
              padding: "0.6rem 1.1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Tekrar Dene
          </button>
        </div>
      </body>
    </html>
  );
}
