import { cn } from "@/lib/utils";

/**
 * Uygulamanin zemini: termal akis. Solda soguk (buz mavisi), sagda sicak
 * (turuncu) isik kutleleri 40-70 sn'lik alternate dongulerle cok yavas yer
 * degistirir; ustte silik izoterm cizgileri. Yalnizca radial-gradient +
 * transform (filtre yok) - ekran kartinda calisir. Stiller: app/iklim.css (.amb).
 */
export function Ambient({ className }: { className?: string }) {
  return (
    <div className={cn("amb", className)} aria-hidden="true">
      <span className="fl f1" />
      <span className="fl f3" />
      <span className="fl f2" />
      <span className="fl f4" />
      <span className="fl f5" />
      <span className="fl f6" />
      <span className="iso" />
    </div>
  );
}
