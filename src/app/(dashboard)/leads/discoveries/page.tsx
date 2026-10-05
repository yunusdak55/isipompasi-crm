import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { getDiscoveryVisitsForMonth } from "@/lib/data/discovery-visits";
import { DiscoveryVisitForm } from "@/components/leads/discovery-visit-form";
import { DiscoveryVisitTable } from "@/components/leads/discovery-visit-table";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";
import { parseYearMonth, partsTR } from "@/lib/time";

const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function buildHref(year: number, month: number) {
  return `/leads/discoveries?y=${year}&m=${month}`;
}

/**
 * "Keşifler" ekrani (spec: "ay içerisinde yapılan keşifler, gidilen yerler
 * ve nasıl geçti gibi bilgileri içersin"). Ay navigasyonu leads/calendar
 * sayfasiyla AYNI desen (?y=&m=).
 */
export default async function DiscoveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  // DUZELTME (denetim bulgusu, bkz. dashboard/page.tsx ayni aciklama).
  const params = await searchParams;
  const today = partsTR(new Date());
  const { year, month } = parseYearMonth(params.y, params.m, { year: today.year, month: today.month });

  // PERF: profil ile veri ayni ag turunda (bkz. dashboard/page.tsx).
  const [profile, visits] = await Promise.all([requireProfile(), getDiscoveryVisitsForMonth(year, month)]);
  if (profile.role === "admin") {
    redirect("/admin/companies");
  }

  const prevMonth = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
  const nextMonth = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };

  return (
    <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-5 shadow-elevated-lg sm:p-6">
      <HvacBackdrop intensity="ambient" />
      <div className="relative flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white">Keşifler</h1>
            <p className="text-sm text-white/55">Bu ay yapılan keşif ziyaretleri: kime, ne zaman, nerede ve nasıl geçti.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={buildHref(prevMonth.y, prevMonth.m)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] text-white transition-all duration-150 ease-snappy hover:border-white/25 hover:bg-white/[0.12] active:scale-95"
              aria-label="Önceki ay"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <span className="w-36 text-center text-sm font-medium text-white">
              {TR_MONTHS[month]} {year}
            </span>
            <Link
              href={buildHref(nextMonth.y, nextMonth.m)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] text-white transition-all duration-150 ease-snappy hover:border-white/25 hover:bg-white/[0.12] active:scale-95"
              aria-label="Sonraki ay"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <DiscoveryVisitForm />

        <DiscoveryVisitTable visits={visits} />
      </div>
    </div>
  );
}
