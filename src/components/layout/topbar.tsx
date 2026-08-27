import { LogOut, Menu } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";
import { getInitials } from "@/lib/utils";
import { USER_ROLE_LABELS } from "@/lib/constants/lead";
import { NotificationBell } from "@/components/layout/notification-bell";
import type { Profile } from "@/lib/types/domain";
import type { DueFollowup } from "@/lib/data/leads";

export function Topbar({
  profile,
  companyName,
  dueFollowups,
  onMenuClick,
}: {
  profile: Profile;
  companyName: string | null;
  dueFollowups: DueFollowup[];
  onMenuClick?: () => void;
}) {
  const displayName = profile.full_name ?? profile.email ?? "Kullanıcı";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-brand-950/40 bg-brand-900 px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Menüyü aç"
          className="group flex h-9 w-9 items-center justify-center rounded-lg text-white/70 transition-all duration-150 ease-snappy hover:bg-white/[0.08] hover:text-white active:scale-90 lg:hidden"
        >
          <Menu className="h-5 w-5 transition-transform duration-150 ease-snappy group-hover:scale-110" />
        </button>
        <p className="truncate text-sm font-medium text-white/90">
          {companyName ?? (profile.role === "admin" ? "Ajans Admin Paneli" : "—")}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell items={dueFollowups} />

        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight text-white">{displayName}</p>
          <p className="text-xs leading-tight text-white/50">{USER_ROLE_LABELS[profile.role]}</p>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-500/15 text-sm font-semibold text-accent-300 ring-1 ring-inset ring-accent-500/25 transition-transform duration-150 ease-snappy hover:scale-105">
          {getInitials(displayName)}
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            title="Çıkış Yap"
            aria-label="Çıkış Yap"
            className="group flex h-9 w-9 items-center justify-center rounded-lg text-white/60 transition-all duration-150 ease-snappy hover:bg-danger-500/15 hover:text-danger-300 active:scale-90"
          >
            <LogOut className="h-4 w-4 transition-transform duration-150 ease-snappy group-hover:translate-x-0.5" />
          </button>
        </form>
      </div>
    </header>
  );
}
