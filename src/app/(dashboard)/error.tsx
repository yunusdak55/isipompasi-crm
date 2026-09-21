"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * DUZELTME (performans/guvenirlik denetimi: "bazen hata veriyor"): bu
 * uygulamada HICBIR route grubunda error.tsx yoktu. Next.js App Router'da
 * bir Server Component icinde beklenmeyen bir hata (ag zaman asimi, Supabase
 * sorgu hatasi, beklenmeyen veri sekli vb.) yakalanmadiginda kullaniciya
 * varsayilan, markasiz, cogu zaman bos/beyaz bir "Application error" ekrani
 * gosterilir - kullaniciya "site hata veriyor" olarak yansiyan tam olarak bu.
 * Bu sinir (boundary), (dashboard) altindaki HERHANGI bir sayfada olusan
 * hatayi yakalayip sadece o icerik alanini (sidebar/ust bar duruyor) kibarca
 * gosterir ve tek tikla yeniden deneme sunar - sayfayi/oturumu kaybetmeden.
 */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Dashboard route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-2xl border border-line bg-surface p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-500/10 text-danger-600">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-ink-900">Bir şeyler ters gitti</h2>
        <p className="mt-1 max-w-sm text-sm text-ink-500">
          Bu sayfa yüklenirken beklenmeyen bir hata oluştu. Bağlantınızı kontrol edip tekrar deneyebilirsiniz.
        </p>
      </div>
      <Button onClick={() => reset()} className="gap-1.5">
        <RotateCw className="h-4 w-4" />
        Tekrar Dene
      </Button>
    </div>
  );
}
