"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * LISTE / TABLO SATIRLARI icin Link: gorunur olunca DEGIL, kullanici niyet
 * gosterince (fare ustune gelince / klavye odagi / dokunma) prefetch eder.
 *
 * NEDEN (canli olcum 2026-10-05, bkz. docs/performans-raporu-2026-10-05.md):
 * varsayilan <Link> ekrana giren HER satir icin 2 `_rsc` istegi atiyordu -
 * Leadler sayfasi acilisinda 20+, Dashboard'da 25 istek; her router.refresh()
 * ve her sayfa gecisinde hepsi YENIDEN. Saatlik oturum yenilemesinde bu
 * paralel isteklerin her biri ayri token yenilemesi baslatiyordu.
 * Desen Next.js'in kendi onerisi: node_modules/next/dist/docs/01-app/02-guides/
 * prefetching.md -> "Hover-triggered prefetch". Sidebar linkleri (az sayida,
 * sabit) normal <Link> olarak kalir.
 */
export function IntentLink({ onMouseEnter, onFocus, onTouchStart, ...props }: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [active, setActive] = useState(false);

  return (
    <Link
      {...props}
      prefetch={active ? null : false}
      onMouseEnter={(e) => {
        setActive(true);
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        setActive(true);
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        setActive(true);
        onTouchStart?.(e);
      }}
    />
  );
}
