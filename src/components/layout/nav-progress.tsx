"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * SAYFA GECISI GOSTERGESI - icerik alaninin ustunde ince bir serit; YALNIZCA
 * gecis ~150 ms'den uzun surerse gorunur (CSS gecikmesi, bkz. globals.css
 * `.nav-progress`).
 *
 * NEDEN (olcum 2026-10-05, bkz. docs/performans-raporu-2026-10-05.md): eskiden
 * her rotada `loading.tsx` (iskelet) vardi. Iskelet tiklamada aninda geliyordu
 * ama React, bir Suspense yedegi gosterildikten sonra asil icerigi EN AZ 300 ms
 * bekletir (react-dom FALLBACK_THROTTLE_MS). Sunucu 100 ms'de yanit verse bile
 * icerik 300 ms'den once gorunmuyordu (olculen: 307-311 ms taban). Iskeletler
 * kaldirildi: gecis sunucu yaniti gelir gelmez tamamlanir; yavas kalirsa bu
 * serit "tiklaman alindi" der (Next.js'in onerdigi desen: gecikmeli ipucu,
 * node_modules/next/dist/docs/.../use-link-status.md "Gracefully handling fast
 * navigation").
 *
 * Tum <a> tiklamalarini (menu, satir, sayfalama, dugme-link) tek yerden yakalar;
 * adres degisince kendiliginden kapanir. Gecis hic tamamlanmazsa (ag hatasi,
 * iptal) 10 sn sonra kapanir.
 */
export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = `${pathname}?${searchParams.toString()}`;
  // Tiklamanin yapildigi adres: adres degisince `pending` kendiliginden false olur.
  const [clickedAt, setClickedAt] = useState<string | null>(null);
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Yeni sekme / indirme / degistirici tusla tiklama sayfayi degistirmez.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      setClickedAt(current);
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setClickedAt(null), 10_000);
    };
    // capture: Link kendi tiklama isleyicisinde varsayilan davranisi engeller.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [current]);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  const pending = clickedAt !== null && clickedAt === current;
  return <div aria-hidden className={pending ? "nav-progress is-pending" : "nav-progress"} />;
}
