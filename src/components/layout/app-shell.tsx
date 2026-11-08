"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { NavProgress } from "@/components/layout/nav-progress";
import { SessionKeeper } from "@/components/layout/session-keeper";
import { Ambient } from "@/components/decor/ambient";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types/domain";
import type { DueFollowup } from "@/lib/data/leads";

/**
 * Sidebar + Topbar + icerik govdesi. Mobilde sidebar varsayilan olarak
 * ekran disina (drawer) alinir, Topbar'daki menu butonuyla acilir - spec
 * md.14: "sadece masaustunu kucultmek degil", gercek mobil kullanilabilirlik.
 */
export function AppShell({
  profile,
  companyName,
  dueFollowups,
  sessionExpiresIn = null,
  children,
}: {
  profile: Profile;
  companyName: string | null;
  dueFollowups: DueFollowup[];
  /** Erisim jetonunun kalan suresi (sn); verilirse oturum arka planda yenilenir. */
  sessionExpiresIn?: number | null;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Sayfa degistiginde mobil drawer'i otomatik kapat.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Girisin hemen ardindan (login/page.tsx isaret birakir) tek seferlik "acilis"
  // koreografisi: zemin acilir, menu soldan, ust cubuk yukaridan gelir.
  const [arriving, setArriving] = useState(false);
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("ik:arrive") !== "1") return;
      window.sessionStorage.removeItem("ik:arrive");
    } catch {
      return;
    }
    queueMicrotask(() => setArriving(true));
    const t = window.setTimeout(() => setArriving(false), 1700);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className={cn("flex h-screen", arriving && "is-arriving")}>
      <Ambient />
      {sidebarOpen ? (
        <div
          aria-hidden
          onClick={() => setSidebarOpen(false)}
          className="animate-fade-in fixed inset-0 z-30 bg-[rgba(3,9,20,0.7)] backdrop-blur-[4px] lg:hidden [.fx-lite_&]:backdrop-blur-none"
        />
      ) : null}

      <div
        className={cn(
          "ik-rail-wrap fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-premium lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar role={profile.role} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar profile={profile} companyName={companyName} dueFollowups={dueFollowups} onMenuClick={() => setSidebarOpen(true)} />
        {/* Yavas kalan sayfa gecislerinde gorunen ince serit (bkz. NavProgress). */}
        <div className="relative h-0">
          <Suspense fallback={null}>
            <NavProgress />
            <SessionKeeper expiresIn={sessionExpiresIn} />
          </Suspense>
        </div>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:px-8 lg:pt-7">
          {/* Sayfa gecisi: her yeni sayfa bulaniktan netlesir (anahtar = yol). */}
          <div key={pathname} className="view-enter mx-auto w-full max-w-[1320px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
