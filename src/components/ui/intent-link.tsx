"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * LISTE / TABLO SATIRLARI icin Link: prefetch YAPMAZ.
 *
 * NEDEN (canli olcum 2026-10-05, bkz. docs/performans-raporu-2026-10-05.md):
 * varsayilan <Link> ekrana giren HER satir icin 2 `_rsc` istegi atiyordu -
 * Leadler sayfasi acilisinda 20+, Dashboard'da 25 istek; her sayfa gecisinde
 * hepsi YENIDEN. Bir ara "fare ustune gelince prefetch" yapiliyordu; rotalardan
 * loading.tsx kaldirilinca (bkz. components/layout/nav-progress.tsx) dinamik
 * rotada onceden cekilecek bir sey kalmadi, o istekler de bosa gidiyordu.
 * Tiklamada veri sunucudan taze gelir; gecikirse NavProgress seridi gorunur.
 */
export function IntentLink(props: Omit<ComponentProps<typeof Link>, "prefetch">) {
  return <Link {...props} prefetch={false} />;
}
