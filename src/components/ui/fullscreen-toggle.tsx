"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Gercek Fullscreen API ile tam ekran gec/cik (spec 2026-10-01: "basinca tam
 * ekrana gecis yapan bir buton koy" - kokpit hissini gucledirmek icin,
 * telefonda konusurken ekranin geri kalanini (sidebar, adres cubugu) devre
 * disi birakip SADECE bu sayfaya odaklanmayi sagliyor).
 */
export function FullscreenToggle({ className }: { className?: string }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggle() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/80 transition-colors duration-150 ease-snappy hover:border-accent-400/40 hover:bg-accent-500/[0.14] hover:text-white",
        className
      )}
    >
      {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
      {isFullscreen ? "Tam Ekrandan Çık" : "Tam Ekran"}
    </button>
  );
}
