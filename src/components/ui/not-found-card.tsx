import { Compass } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Olmayan sayfa / silinmis kayit icin markali 404. Eskiden Next.js'in beyaz,
 * markasiz varsayilan 404 ekrani gorunuyordu (koyu panelde sert bir "kopma").
 */
export function NotFoundCard({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-5 p-8 text-center", fullScreen ? "min-h-screen" : "min-h-[55vh]")}>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ice-500/10 text-ice-300 ring-1 ring-inset ring-ice-500/25 shadow-[0_0_30px_-8px_rgba(91,188,248,0.6)]">
        <Compass className="h-7 w-7" />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">404</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink-900">Sayfa bulunamadı</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-600">
          Aradığınız sayfa ya da kayıt taşınmış, silinmiş ya da bağlantı hatalı olabilir.
        </p>
      </div>
      <LinkButton href="/dashboard">Dashboard&apos;a dön</LinkButton>
    </div>
  );
}
