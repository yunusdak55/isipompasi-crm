/**
 * DOGRULAMA ARACI - dashboard_today() (migration 0032) sonucunu, uygulamadaki
 * TEK kurallarla (src/lib/utils.ts isLeadOverdue / isLeadNew) BIREBIR
 * karsilastirir. SQL tarafi ve JS tarafi sapmasin diye kural degistiginde
 * bu script calistirilir.
 *
 * SADECE .env.perftest.local'deki izole test projesine karsi calisir
 * (production'a karsi calismayi REDDEDER). Gercek kullanici JWT'siyle (owner ve
 * sales rolleri) cagirir - RLS dahil, uygulamayla ayni yol.
 *
 *   npx tsx scripts/verify-dashboard-today.mts
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { FOLLOWUP_OVERDUE_HOURS, NEW_LEAD_HOURS, isLeadNew, isLeadOverdue } from "../src/lib/utils";
import { DAY_MS, partsTR, shiftMonth, startOfDayTR } from "../src/lib/time";

const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.perftest.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const creds = JSON.parse(fs.readFileSync(".perftest-credentials.json", "utf8")) as {
  ownerEmail: string;
  ownerPassword: string;
  salesEmails: string[];
  salesPassword?: string;
};

const PROD_REF = "dhnwcvirgnkpnlrurdap";
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
if (!URL_ || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PROJECT_REF === PROD_REF || URL_.includes(PROD_REF)) {
  console.error("DURDURULDU: test projesi ayarlari eksik ya da PRODUCTION'a isaret ediyor.");
  process.exit(2);
}

type Row = {
  id: string;
  status: string;
  first_name: string | null;
  last_name: string | null;
  phone: string;
  offered_amount: number | null;
  next_followup_at: string | null;
  last_contact_at: string | null;
  last_activity_at: string | null;
  created_at: string;
};

const NOW = Date.now();
Date.now = () => NOW; // isLeadOverdue/isLeadNew Date.now() kullanir - RPC ile ayni ana sabitle
const NOW_DATE = new Date(NOW);
const DAY_START = startOfDayTR(NOW_DATE).getTime();
const DAY_END = DAY_START + DAY_MS;
const HOUR = 60 * 60 * 1000;
const DUE_LIMIT = 8;
const OTHER_LIMIT = 5;

const { year, month } = partsTR(NOW_DATE);
const nextMonth = shiftMonth(year, month, 1);
const monthDate = (y: number, m0: number) => `${y}-${String(m0 + 1).padStart(2, "0")}-01`;
const MONTH_START = monthDate(year, month);
const MONTH_END = monthDate(nextMonth.year, nextMonth.month);

type Item = { id: string };
type Payload = {
  counts: { overdue: number; due: number; due_carry: number; new: number };
  week: Record<string, number>;
  month: { sales_count: number; revenue: number };
  overdue: Item[];
  due: Item[];
  new: Item[];
  stats: { total: number; pipeline_value: number; by_status: Record<string, number> };
};

async function check(label: string, email: string, password: string) {
  const supabase = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    console.log(`  [${label}] giris yapilamadi (${authError.message}) - atlandi`);
    return true;
  }

  // 1) Referans: kullanicinin gorebildigi TUM leadler (RLS dahil), JS'te siniflandirilir.
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("leads")
      .select("id, status, first_name, last_name, phone, offered_amount, next_followup_at, last_contact_at, last_activity_at, created_at")
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data as Row[]));
    if (!data || data.length < 1000) break;
  }

  const open = rows.filter((r) => r.status !== "won" && r.status !== "lost");
  const at = (r: Row) => new Date(r.next_followup_at as string).getTime();
  const createdMs = (r: Row) => new Date(r.created_at).getTime();
  const toOverdueInput = (r: Row) => ({
    status: r.status,
    lastContactAt: r.last_contact_at,
    createdAt: r.created_at,
    nextFollowupAt: r.next_followup_at,
    lastActivityAt: r.last_activity_at,
  });

  const overdue = open.filter((r) => isLeadOverdue(toOverdueInput(r)));
  const overdueIds = new Set(overdue.map((r) => r.id));
  const due = open.filter((r) => r.next_followup_at && !overdueIds.has(r.id) && at(r) >= NOW - FOLLOWUP_OVERDUE_HOURS * HOUR && at(r) < DAY_END);

  // "Yeni": SQL (created >= now - 24sa) ile uygulama kurali isLeadNew AYNI kumeyi vermeli. isLeadNew ek olarak
  // "gecikmemis" sarti arar - olusturulali <24 saat olan bir leadin takibi (olusturulmadan once tarihli olmadikca)
  // 24 saati asamayacagi icin iki tanim pratikte aynidir; fark varsa raporlanir.
  const fresh = open.filter((r) => createdMs(r) >= NOW - NEW_LEAD_HOURS * HOUR);
  const freshByApp = open.filter((r) => isLeadNew(toOverdueInput(r)));
  const freshDiff =
    fresh.filter((r) => !freshByApp.some((x) => x.id === r.id)).length + freshByApp.filter((r) => !fresh.some((x) => x.id === r.id)).length;

  // Hafta: gun sonundan itibaren 6 gunluk pencere, gun gun.
  const weekExpected: Record<string, number> = {};
  for (const r of open) {
    if (!r.next_followup_at) continue;
    const t = at(r);
    if (t >= DAY_END && t < DAY_END + 6 * DAY_MS) {
      const k = String(Math.floor((t - DAY_END) / DAY_MS));
      weekExpected[k] = (weekExpected[k] ?? 0) + 1;
    }
  }

  // Bu ay satisi (RLS dahil - kullanicinin gorebildigi satislar).
  const { data: salesRows, error: salesError } = await supabase
    .from("sales")
    .select("sale_amount, sale_date")
    .gte("sale_date", MONTH_START)
    .lt("sale_date", MONTH_END);
  if (salesError) throw new Error(salesError.message);
  const monthExpected = {
    sales_count: salesRows.length,
    revenue: salesRows.reduce((sum, s) => sum + Number(s.sale_amount), 0),
  };

  const byId = (a: Row, b: Row) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const expected = {
    counts: { overdue: overdue.length, due: due.length, due_carry: due.filter((r) => at(r) < DAY_START).length, new: fresh.length },
    overdue: [...overdue].sort((a, b) => at(b) - at(a) || byId(a, b)).slice(0, OTHER_LIMIT).map((r) => r.id),
    due: [...due].sort((a, b) => at(a) - at(b) || byId(a, b)).slice(0, DUE_LIMIT).map((r) => r.id),
    new: [...fresh].sort((a, b) => createdMs(b) - createdMs(a) || byId(a, b)).slice(0, OTHER_LIMIT).map((r) => r.id),
  };

  // 2) Gercek RPC (uygulamadaki cagriyla ayni parametreler), 5 kez - sure olcumu.
  const args = {
    p_now: NOW_DATE.toISOString(),
    p_day_start: new Date(DAY_START).toISOString(),
    p_day_end: new Date(DAY_END).toISOString(),
    p_month_start: MONTH_START,
    p_month_end: MONTH_END,
    p_overdue_hours: FOLLOWUP_OVERDUE_HOURS,
    p_new_hours: NEW_LEAD_HOURS,
    p_due_limit: DUE_LIMIT,
    p_other_limit: OTHER_LIMIT,
  };
  const times: number[] = [];
  let actual = null as unknown as Payload;
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const { data, error } = await supabase.rpc("dashboard_today", args);
    times.push(performance.now() - t0);
    if (error) throw new Error(`rpc: ${error.message}`);
    actual = data as unknown as Payload;
  }

  // Satis hatti: SQL'den BAGIMSIZ sayimlar (her durum icin dogrudan "exact count" sorgusu) + toplam + potansiyel deger.
  const STATUSES = ["new", "discovery_offer", "followup", "won", "lost"];
  const statusCounts: Record<string, number> = {};
  for (const st of STATUSES) {
    const { count, error } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", st);
    if (error) throw new Error(error.message);
    statusCounts[st] = count ?? 0;
  }
  const { count: totalCount, error: totalError } = await supabase.from("leads").select("id", { count: "exact", head: true });
  if (totalError) throw new Error(totalError.message);
  const pipelineExpected = open.reduce((sum, r) => sum + (r.offered_amount ?? 0), 0);
  const sumOfStages = STATUSES.reduce((sum, st) => sum + (statusCounts[st] ?? 0), 0);
  const openStages = ["new", "discovery_offer", "followup"].reduce((sum, st) => sum + Number(actual.stats.by_status[st] ?? 0), 0);
  const closedStages = ["won", "lost"].reduce((sum, st) => sum + Number(actual.stats.by_status[st] ?? 0), 0);

  const ids = (list: Item[]) => list.map((x) => x.id);
  const sortKeys = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
  const checks: [string, unknown, unknown][] = [
    ["counts", sortKeys(expected.counts), sortKeys(actual.counts)],
    ["overdue listesi + sira", expected.overdue, ids(actual.overdue)],
    ["bugunku takip listesi + sira", expected.due, ids(actual.due)],
    ["yeni listesi + sira", expected.new, ids(actual.new)],
    ["hafta (gun gun)", sortKeys(weekExpected), sortKeys(actual.week)],
    ["bu ay satis", monthExpected, { sales_count: Number(actual.month.sales_count), revenue: Number(actual.month.revenue) }],
    ["stats.total == bagimsiz toplam sayim", totalCount, Number(actual.stats.total)],
    ["stats.total == okunan satir sayisi", rows.length, Number(actual.stats.total)],
    ["asama sayilari (her biri bagimsiz sayim)", sortKeys(statusCounts), sortKeys(Object.fromEntries(STATUSES.map((st) => [st, Number(actual.stats.by_status[st] ?? 0)])))],
    ["asamalarin toplami == toplam lead", Number(actual.stats.total), sumOfStages],
    ["acik + sonuclanan == toplam (kartin hiyerarsisi)", Number(actual.stats.total), openStages + closedStages],
    ["potansiyel satis (acik leadlerin teklif toplami)", pipelineExpected, Number(actual.stats.pipeline_value)],
    ["isLeadNew == SQL yeni", 0, freshDiff],
  ];

  let ok = true;
  console.log(`  [${label}] gorulen lead: ${rows.length}, acik: ${open.length}`);
  for (const [name, exp, act] of checks) {
    const same = JSON.stringify(exp) === JSON.stringify(act);
    if (!same) ok = false;
    console.log(`    ${same ? "OK  " : "FARK"} ${name}${same ? "" : `\n       beklenen: ${JSON.stringify(exp)}\n       gelen:    ${JSON.stringify(act)}`}`);
  }
  console.log(`    sayilar: ${JSON.stringify(actual.counts)}  hafta: ${JSON.stringify(sortKeys(actual.week))}  ay: ${JSON.stringify(actual.month)}`);

  // 3) Kenar durumlar: scratch scriptle eklenen "EDGE" leadleri icin, iki uygulamadan
  //    BAGIMSIZ elle yazilmis beklentiler (hangi lead hangi kovada olmali).
  const edge = rows.filter((r) => r.first_name === "EDGE");
  if (edge.length > 0) {
    const { data: wideData, error: wideError } = await supabase.rpc("dashboard_today", { ...args, p_due_limit: 1000, p_other_limit: 1000 });
    if (wideError) throw new Error(wideError.message);
    const wide = wideData as unknown as Payload;
    const inList = (list: Item[], id: string) => list.some((x) => x.id === id);
    const bucketsOf = (id: string) =>
      [inList(wide.overdue, id) && "overdue", inList(wide.due, id) && "due", inList(wide.new, id) && "new"].filter(Boolean).join("+") || "-";
    const expectBucket: Record<string, string> = {
      N1: "new", N2: "-", N3: "due+new", N4: "-",
      D1: "due", D2: "due", O1: "overdue", O2: "-", O3: "overdue",
      W1: "-", W2: "-", W3: "-", X1: "-",
    };
    for (const r of edge) {
      const tag = r.last_name as string;
      const got = bucketsOf(r.id);
      const same = got === expectBucket[tag];
      if (!same) ok = false;
      console.log(`    ${same ? "OK  " : "FARK"} kenar ${tag}: ${got}${same ? "" : ` (beklenen ${expectBucket[tag]})`}`);
    }
  }

  const sorted = [...times].sort((a, b) => a - b);
  console.log(`    RPC suresi (5 cagri, ag dahil): ilk ${times[0].toFixed(0)}ms, medyan ${sorted[2].toFixed(0)}ms, en iyi ${sorted[0].toFixed(0)}ms`);
  return ok;
}

console.log(`dashboard_today dogrulama - test projesi, ${NOW_DATE.toISOString()}`);
const results = [
  await check("owner", creds.ownerEmail, creds.ownerPassword),
  await check("sales0", creds.salesEmails[0], creds.salesPassword ?? creds.ownerPassword),
  await check("sales1", creds.salesEmails[1], creds.salesPassword ?? creds.ownerPassword),
];
console.log(results.every(Boolean) ? "\nSONUC: TUM KONTROLLER GECTI" : "\nSONUC: FARK VAR");
process.exit(results.every(Boolean) ? 0 : 1);
