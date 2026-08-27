"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
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
  children,
}: {
  profile: Profile;
  companyName: string | null;
  dueFollowups: DueFollowup[];
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Sayfa degistiginde mobil drawer'i otomatik kapat.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen bg-canvas">
      {sidebarOpen ? (
        <div
          aria-hidden
          onClick={() => setSidebarOpen(false)}
          className="animate-fade-in fixed inset-0 z-30 bg-brand-950/70 lg:hidden"
        />
      ) : null}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-premium lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar role={profile.role} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar profile={profile} companyName={companyName} dueFollowups={dueFollowups} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
