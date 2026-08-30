"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  CalendarDays,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  BarChart3,
  Settings,
  Building2,
  UserCog,
  Plug,
  Cog,
  MessageCircle,
  Compass,
  Radar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import type { UserRole } from "@/lib/types/domain";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
  children?: NavItem[];
};

// spec: sidebar 3 sade gruba ayrildi (SATIS / ANALIZ / AYARLAR). "Teklifler",
// "Sicak Leadler", "Ulasilamayanlar", "Kayiplar" kaldirildi - bunlar zaten
// Leadler ekranindaki durum filtresiyle erisilebilir, ayri menu olarak
// kalabalik yaratmasin diye eklenmedi.
const SALES_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, enabled: true },
  { href: "/leads", label: "Leadler", icon: Users, enabled: true },
  { href: "/leads/followups", label: "Takipte", icon: CalendarClock, enabled: true },
  { href: "/leads/calendar", label: "Takvim", icon: CalendarDays, enabled: true },
  { href: "/leads/overdue", label: "Gecikenler", icon: AlertTriangle, enabled: true },
];

// Dijital Ajan SADECE bu uc alt modulden olusuyor - baska agent sayfasi eklenmez.
const ANALYSIS_NAV_ITEMS: NavItem[] = [
  { href: "/sales", label: "Satışlar", icon: TrendingUp, enabled: true },
  { href: "/reports", label: "Raporlar", icon: BarChart3, enabled: true },
  {
    href: "/agent",
    label: "Dijital Ajan",
    icon: Sparkles,
    enabled: true,
    children: [
      { href: "/agent/chat", label: "Ajan ile Sohbet", icon: MessageCircle, enabled: true },
      { href: "/agent/competitors", label: "Rakip Analizi", icon: Compass, enabled: true },
      { href: "/agent/industry", label: "Sektör Durumu", icon: Radar, enabled: true },
    ],
  },
];

const SETTINGS_NAV_ITEMS: NavItem[] = [{ href: "/settings", label: "Firma Ayarları", icon: Settings, enabled: true }];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin/companies", label: "Firmalar", icon: Building2, enabled: true },
  { href: "/admin/users", label: "Kullanıcılar", icon: UserCog, enabled: true },
  { href: "/admin/integrations", label: "Entegrasyonlar", icon: Plug, enabled: true },
  { href: "/admin/settings", label: "Sistem Ayarları", icon: Cog, enabled: false },
];

const ALL_HREFS = [...SALES_NAV_ITEMS, ...ANALYSIS_NAV_ITEMS, ...SETTINGS_NAV_ITEMS, ...ADMIN_NAV_ITEMS].flatMap(
  (item) => [item.href, ...(item.children?.map((c) => c.href) ?? [])]
);

/**
 * "/leads" gibi kisa bir href, "/leads/followups" gibi daha spesifik baska
 * bir nav linkinin altinda kalirsa (path prefix cakismasi) yanlislikla aktif
 * gorunmesin diye: sadece pathname'i "kapsayan" href'ler arasinda EN UZUN
 * (en spesifik) olan aktif sayilir.
 */
function isActiveHref(pathname: string, href: string) {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  const moreSpecificMatch = ALL_HREFS.some(
    (other) => other !== href && other.length > href.length && pathname.startsWith(other)
  );
  return !moreSpecificMatch;
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wide text-white/35 first:mt-0">
      {children}
    </p>
  );
}

function NavLink({ item, active, nested = false }: { item: NavItem; active: boolean; nested?: boolean }) {
  const Icon = item.icon;

  if (!item.enabled) {
    return (
      <div
        className="flex cursor-not-allowed items-center justify-between rounded-lg border-l-2 border-transparent py-2 pl-[10px] pr-3 text-sm text-white/30"
        title="Yakında"
      >
        <span className="flex items-center gap-2.5">
          <Icon className="h-4 w-4" />
          {item.label}
        </span>
        <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/35">Yakında</span>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      // DUZELTME (canli denetimde yakalanan gercek hata): Dashboard sayfasi
      // sidebar'dan tekrar ziyaret edildiginde bazen eski/"0" degerler
      // gosteriyordu - gercek bir lead uygulama uzerinden eklenip
      // revalidatePath("/dashboard") calistiktan SONRA bile. Kok neden: bu
      // link her sayfada gorunur oldugu icin Next.js daha kullanicinin
      // oturumu/firma verisi tam otururmadan ONCE otomatik olarak arka
      // planda prefetch ediyor, o anki (bos/eksik) sonucu 5 dakikaligina
      // istemci onbellegine yaziyor - sonraki tum tiklamalar gercek veri
      // yerine bu erken/yanlis onbellegi gosteriyordu. prefetch={false}
      // bunu tamamen engeller (bkz. next.config.mjs'teki staleTimes ek
      // guvenlik agi).
      prefetch={false}
      className={cn(
        // Aktif gostergesi sadece bg degil - sol kenarda hep-var-olan (2px,
        // rezerve edilmis) turuncu bir seritle + cok kontrollu bir glow: koyu
        // lacivert zeminde "marka vurgusu" turuncu burada tasiyici rol oynuyor.
        "flex items-center gap-2.5 rounded-lg border-l-2 py-2 pl-[10px] pr-3 font-medium transition-all duration-150 ease-premium",
        nested ? "text-[13px]" : "text-sm",
        active
          ? "border-accent-500 bg-accent-500/[0.12] text-white shadow-[inset_0_0_0_1px_rgba(244,124,32,0.15)]"
          : "border-transparent text-white/65 hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
      )}
    >
      <Icon className={cn(nested ? "h-3.5 w-3.5" : "h-4 w-4", active && "text-accent-400")} />
      {item.label}
    </Link>
  );
}

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();

  return (
    <aside className="relative flex h-screen w-64 shrink-0 flex-col overflow-hidden bg-brand-900">
      {/* Cok dusuk kontrastli teknik atmosfer - sidebar'in tamamini degil,
          sadece zemini hafifce "canlandirir". */}
      <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden>
        <div className="absolute -left-20 top-0 h-64 w-64 rounded-full bg-brand-500/25 blur-[90px]" />
        <div className="absolute -right-16 bottom-24 h-56 w-56 rounded-full bg-accent-500/[0.08] blur-[100px]" />
      </div>

      <div className="relative flex h-16 shrink-0 items-center border-b border-white/10 px-5">
        <Logo className="h-6" />
      </div>

      <nav className="relative flex flex-1 flex-col overflow-y-auto p-3">
        {/* Ajans admin'in kendine ait bir firmasi yok (company_id = null) -
            Leadler/Kanban/Takip/Satislar/Raporlar gibi gunluk operasyon
            ekranlari admin icin anlamsiz (RLS geregi TUM firmalarin verisini
            karisik/filtresiz gosterirler, hangi leadin hangi firmaya ait
            oldugu ayirt edilemez). Admin sadece kendisi icin yapilmis olan
            Ajans Admin grubunu gorur. */}
        {role !== "admin" ? (
          <>
            <GroupLabel>Satış</GroupLabel>
            <div className="flex flex-col gap-1">
              {SALES_NAV_ITEMS.map((item) => (
                <NavLink key={item.href} item={item} active={isActiveHref(pathname, item.href)} />
              ))}
            </div>

            <GroupLabel>Analiz</GroupLabel>
            <div className="flex flex-col gap-1">
              {ANALYSIS_NAV_ITEMS.map((item) => (
                <div key={item.href} className="flex flex-col gap-1">
                  <NavLink item={item} active={isActiveHref(pathname, item.href)} />
                  {item.children ? (
                    <div className="ml-[19px] flex flex-col gap-1 border-l border-white/10 pl-2">
                      {item.children.map((child) => (
                        <NavLink key={child.href} item={child} active={isActiveHref(pathname, child.href)} nested />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <GroupLabel>Ayarlar</GroupLabel>
            <div className="flex flex-col gap-1">
              {SETTINGS_NAV_ITEMS.map((item) => (
                <NavLink key={item.href} item={item} active={isActiveHref(pathname, item.href)} />
              ))}
            </div>
          </>
        ) : null}

        {role === "admin" ? (
          <>
            <GroupLabel>Ajans Admin</GroupLabel>
            <div className="flex flex-col gap-1">
              {ADMIN_NAV_ITEMS.map((item) => (
                <NavLink key={item.href} item={item} active={isActiveHref(pathname, item.href)} />
              ))}
            </div>
          </>
        ) : null}
      </nav>
    </aside>
  );
}
