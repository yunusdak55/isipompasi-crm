"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  CalendarDays,
  AlertTriangle,
  TrendingUp,
  Bot,
  BarChart3,
  Settings,
  Building2,
  UserCog,
  Plug,
  Cog,
  PhoneCall,
  MapPinned,
  ScrollText,
  Headset,
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
  { href: "/leads/discoveries", label: "Keşifler", icon: MapPinned, enabled: true },
  { href: "/leads/calendar", label: "Takvim", icon: CalendarDays, enabled: true },
  { href: "/leads/overdue", label: "Gecikenler", icon: AlertTriangle, enabled: true },
];

// Dijital Ajan artik TEK bir sayfa (spec 2026-09-28: "tek'e indir, rakip
// analizi sektor analizi falan kalksin") - alt modul/children yok.
const ANALYSIS_NAV_ITEMS: NavItem[] = [
  { href: "/sales", label: "Satışlar", icon: TrendingUp, enabled: true },
  { href: "/reports", label: "Raporlar", icon: BarChart3, enabled: true },
  { href: "/agent", label: "Dijital Ajan", icon: Bot, enabled: true },
];

const SETTINGS_NAV_ITEMS: NavItem[] = [{ href: "/settings", label: "Firma Ayarları", icon: Settings, enabled: true }];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin/companies", label: "Firmalar", icon: Building2, enabled: true },
  {
    href: "/admin/prospects",
    label: "Satış Görüşmeleri",
    icon: PhoneCall,
    enabled: true,
    children: [
      { href: "/admin/prospects/playbook", label: "Satış Kokpiti", icon: Headset, enabled: true },
      { href: "/admin/prospects/followups", label: "Takipte", icon: CalendarClock, enabled: true },
      { href: "/admin/prospects/overdue", label: "Gecikenler", icon: AlertTriangle, enabled: true },
      { href: "/admin/prospects/calendar", label: "Görüşme Takvimi", icon: CalendarDays, enabled: true },
    ],
  },
  { href: "/admin/users", label: "Kullanıcılar", icon: UserCog, enabled: true },
  { href: "/admin/integrations", label: "Entegrasyonlar", icon: Plug, enabled: true },
  { href: "/admin/audit", label: "Denetim Kaydı", icon: ScrollText, enabled: true },
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
    <p className="mb-1.5 mt-6 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30 first:mt-0">
      {children}
    </p>
  );
}

/**
 * Tiklama geri bildirimi (bkz. node_modules/next/dist/docs/.../use-link-status.md):
 * hedef sayfanin iskeleti onbellekte DEGILSE (uzun sure bosta kalan sekme, yavas
 * ag) gecis sunucu yanitini bekler; o arada ekranda hicbir sey degismezse
 * kullanici "dondu" sanar. Bu nokta tiklanan linkte ANINDA belirir. Sabit
 * boyutlu, yalnizca opaklik degisir (yerlesim kaymasi yok); iskelet
 * onbellekteyse Next.js pending asamasini atlar ve hic gorunmez.
 */
function NavPendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400 transition-opacity duration-150",
        pending ? "animate-pulse opacity-100" : "opacity-0"
      )}
    />
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
      // PERF (jet hizi): prefetch ACIK - tiklamadan once sayfanin iskeleti (loading.tsx)
      // arka planda hazirlanir, tiklayinca bos bekleme olmaz. Iskelet istemcide
      // next.config.mjs -> staleTimes.static (300 sn) kadar gecerlidir; gercek veri
      // staleTimes.dynamic = 0 sayesinde her tiklamada sunucudan taze gelir.
      className={cn(
        // Aktif gostergesi (tasarim yukseltmesi): sol kenarda parlayan gradyanli "hap"
        // (pseudo-element) + soldan saga solan turuncu zemin. Border degil, gercek bir
        // isaret - hover'da gecis sadece renk/opaklik (boyama hafif).
        "relative flex items-center gap-2.5 rounded-lg py-2 pl-3 pr-3 font-medium transition-colors duration-150 ease-premium",
        nested ? "text-[13px]" : "text-sm",
        active
          ? "bg-gradient-to-r from-accent-500/[0.20] via-accent-500/[0.07] to-transparent text-white before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-gradient-to-b before:from-flame-hot before:to-accent-600 before:shadow-[0_0_12px_rgba(244,124,32,0.75)] before:content-['']"
          : "text-white/65 hover:bg-white/[0.06] hover:text-white"
      )}
    >
      <Icon className={cn(nested ? "h-3.5 w-3.5" : "h-4 w-4", active && "text-accent-400")} />
      {item.label}
      <NavPendingDot />
    </Link>
  );
}

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();

  return (
    <aside className="relative flex h-screen w-64 shrink-0 flex-col overflow-hidden border-r border-white/[0.06] bg-brand-900">
      {/* Cok dusuk kontrastli teknik atmosfer - sidebar'in tamamini degil,
          sadece zemini hafifce "canlandirir". */}
      {/* Zemin atmosferi: ESKISINDE iki buyuk katman blur-[90px]/[100px] filtreliydi; ayni
          gorunum filtresiz radyal gradyanla uretiliyor (GPU maliyeti dusuk). */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(420px 380px at -12% -4%, rgba(44,74,117,0.42), transparent 70%), radial-gradient(380px 340px at 112% 84%, rgba(244,124,32,0.08), transparent 70%)",
        }}
      />

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
          </>
        ) : null}
      </nav>
    </aside>
  );
}
