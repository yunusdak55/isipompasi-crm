"use client";

import { useLayoutEffect, useRef, useState } from "react";
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
    <p className="ik-nav-label first:pt-2">{children}</p>
  );
}

/**
 * Tiklama geri bildirimi (bkz. node_modules/next/dist/docs/.../use-link-status.md):
 * gecis sunucu yanitini bekler (rotalarda bilerek loading.tsx YOK, bkz.
 * components/layout/nav-progress.tsx); yanit gecikirse tiklanan linkte bu nokta
 * belirir. 100 ms gecikmeli: hizli gecislerde hic gorunmez ("Gracefully handling
 * fast navigation"). Sabit boyutlu, yalnizca opaklik degisir (yerlesim kaymasi yok).
 */
function NavPendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400 transition-opacity duration-150",
        pending ? "animate-pulse opacity-100 delay-100" : "opacity-0"
      )}
    />
  );
}

function NavLink({ item, active, nested = false }: { item: NavItem; active: boolean; nested?: boolean }) {
  const Icon = item.icon;

  if (!item.enabled) {
    return (
      <div
        className="ik-nav-item cursor-not-allowed justify-between opacity-45"
        title="Yakında"
      >
        <span className="flex items-center gap-3">
          <span className="ik-nav-ic">
            <Icon className="h-[17px] w-[17px]" />
          </span>
          {item.label}
        </span>
        <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/35">Yakında</span>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      // PERF (olcum 2026-10-05): prefetch KAPALI. Rotalar dinamik ve loading.tsx'siz
      // oldugu icin onceden cekilecek bir sey yok (Next.js dinamik rotada prefetch'i
      // atlar); acik birakmak her sayfa acilisinda ~19 bos istek demekti. Veri her
      // tiklamada sunucudan taze gelir (staleTimes.dynamic = 0).
      prefetch={false}
      aria-current={active ? "page" : undefined}
      // Aktif isaret (kayan isik) Sidebar'da tek parca cizilir; burada yalniz ikon kutusu degisir.
      className={cn("ik-nav-item", nested && "is-nested")}
    >
      <span className="ik-nav-ic">
        <Icon className={nested ? "h-3.5 w-3.5" : "h-[17px] w-[17px]"} />
      </span>
      {item.label}
      <NavPendingDot />
    </Link>
  );
}

/**
 * Aktif sayfa isareti: TEK bir isik, sayfalar arasinda kayarak gider (her linkte
 * ayri isaret yerine). Konumu aktif linkin yerinden olculur; yalniz transform.
 */
function useNavGlow(pathname: string) {
  const navRef = useRef<HTMLElement>(null);
  const [glow, setGlow] = useState<{ y: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    const measure = () => {
      const el = nav?.querySelector<HTMLElement>('[aria-current="page"]');
      if (!nav || !el) return setGlow(null);
      const navBox = nav.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      setGlow({ y: box.top - navBox.top + nav.scrollTop, h: box.height });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pathname]);
  return { navRef, glow };
}

export function Sidebar({ role }: { role: UserRole }) {
  const realPath = usePathname();
  // yerel gorsel onizleme (app/dev-onizleme) Dashboard'u gosterir: menude de o aktif gorunsun
  const pathname = realPath === "/dev-onizleme" ? "/dashboard" : realPath;
  const { navRef, glow } = useNavGlow(pathname);

  return (
    <aside className="ik-rail flex h-screen w-64 shrink-0 flex-col overflow-hidden">
      {/* Menu, zeminin "penceresi": izoterm cizgileri burada biraz daha secik, cok yavas kayar. */}
      <span className="ik-rail-photo" aria-hidden="true" />

      <div className="ik-rail-brand flex h-16 shrink-0 items-center px-5">
        <Logo className="h-6" />
      </div>

      <nav ref={navRef} className="ik-nav flex flex-1 flex-col overflow-y-auto px-3 pb-4 pt-1 [scrollbar-width:none]">
        <span
          aria-hidden="true"
          className={cn("ik-nav-glow", glow && "is-on")}
          style={glow ? { transform: `translate3d(12px, ${glow.y}px, 0)`, height: glow.h, right: 24 } : undefined}
        />
        {/* Ajans admin'in kendine ait bir firmasi yok (company_id = null) -
            Leadler/Kanban/Takip/Satislar/Raporlar gibi gunluk operasyon
            ekranlari admin icin anlamsiz (RLS geregi TUM firmalarin verisini
            karisik/filtresiz gosterirler, hangi leadin hangi firmaya ait
            oldugu ayirt edilemez). Admin sadece kendisi icin yapilmis olan
            Ajans Admin grubunu gorur. */}
        {role !== "admin" ? (
          <>
            <GroupLabel>Satış</GroupLabel>
            <div className="flex flex-col gap-0.5">
              {SALES_NAV_ITEMS.map((item) => (
                <NavLink key={item.href} item={item} active={isActiveHref(pathname, item.href)} />
              ))}
            </div>

            <GroupLabel>Analiz</GroupLabel>
            <div className="flex flex-col gap-0.5">
              {ANALYSIS_NAV_ITEMS.map((item) => (
                <div key={item.href} className="flex flex-col gap-1">
                  <NavLink item={item} active={isActiveHref(pathname, item.href)} />
                  {item.children ? (
                    <div className="ml-[21px] flex flex-col gap-0.5 border-l border-[var(--line)] pl-2">
                      {item.children.map((child) => (
                        <NavLink key={child.href} item={child} active={isActiveHref(pathname, child.href)} nested />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <GroupLabel>Ayarlar</GroupLabel>
            <div className="flex flex-col gap-0.5">
              {SETTINGS_NAV_ITEMS.map((item) => (
                <NavLink key={item.href} item={item} active={isActiveHref(pathname, item.href)} />
              ))}
            </div>
          </>
        ) : null}

        {role === "admin" ? (
          <>
            <GroupLabel>Ajans Admin</GroupLabel>
            <div className="flex flex-col gap-0.5">
              {ADMIN_NAV_ITEMS.map((item) => (
                <div key={item.href} className="flex flex-col gap-1">
                  <NavLink item={item} active={isActiveHref(pathname, item.href)} />
                  {item.children ? (
                    <div className="ml-[21px] flex flex-col gap-0.5 border-l border-[var(--line)] pl-2">
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
