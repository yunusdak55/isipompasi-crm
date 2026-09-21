"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * (dashboard) route grubunun DISINDA kalan sayfalar icin genel hata siniri
 * (ör. /login, kok "/" yonlendirme sayfasi). (dashboard)/error.tsx sadece
 * o grubun icini kapsar; bu dosya geri kalan her yeri kapsar. global-error.tsx
 * ise sadece kok layout'un KENDISINDEKI hatalar icin (çok daha nadir) - bkz.
 * o dosyadaki aciklama.
 */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Root route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-500/10 text-danger-600">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-lg font-semibold text-ink-900">Bir şeyler ters gitti</h1>
        <p className="mt-1 max-w-sm text-sm text-ink-500">
          Sayfa yüklenirken beklenmeyen bir hata oluştu. Tekrar deneyebilir veya sayfayı yenileyebilirsiniz.
        </p>
      </div>
      <button
        onClick={() => reset()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-flame-hot via-accent-500 to-flame-ember px-3.5 py-2 text-sm font-medium text-white shadow-glow-accent transition-all duration-150 ease-snappy hover:-translate-y-px active:scale-[0.97]"
      >
        <RotateCw className="h-4 w-4" />
        Tekrar Dene
      </button>
    </div>
  );
}
