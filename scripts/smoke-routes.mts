/**
 * DUMAN TESTI (smoke test) - panelin TUM sayfalarini uc rolle (firma sahibi, satis
 * personeli, ajans admin) VE bos bir firmayla (hic verisi olmayan yeni musteri)
 * gercek oturumla gezer; coken / hata sinirina dusen / yavas sayfayi, bozuk URL
 * girdilerini (gecersiz sayfa, tuhaf arama, olmayan id) yakalar.
 *
 * SADECE .env.perftest.local'deki izole test projesine karsi calisir (production'a
 * karsi calismayi REDDEDER) ve calisan yerel sunucuyu (varsayilan http://localhost:3000)
 * hedefler. Bos-firma senaryosu icin gecici bir firma + kullanici olusturur, sonunda siler.
 *
 *   npx tsx scripts/smoke-routes.mts [--base http://localhost:3000]
 */
import fs from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.perftest.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const creds = JSON.parse(fs.readFileSync(".perftest-credentials.json", "utf8")) as {
  companyId: string;
  ownerEmail: string;
  ownerPassword: string;
  salesEmails: string[];
  salesPassword?: string;
  adminEmail: string;
  adminPassword: string;
};

const PROD_REF = "dhnwcvirgnkpnlrurdap";
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!URL_ || !KEY || env.SUPABASE_PROJECT_REF === PROD_REF || URL_.includes(PROD_REF)) {
  console.error("DURDURULDU: test projesi ayarlari eksik ya da PRODUCTION'a isaret ediyor.");
  process.exit(2);
}
const BASE = process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : "http://localhost:3000";
const SLOW_MS = 4000;

const admin = createClient(URL_, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

/** Gercek bir giris yapar ve sunucunun bekledigi cookie basligini uretir (@supabase/ssr ile ayni bicim). */
async function login(email: string, password: string): Promise<string | null> {
  const jar = new Map<string, string>();
  const supabase = createServerClient(URL_, KEY, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.log(`  giris yapilamadi (${email}): ${error.message}`);
    return null;
  }
  return [...jar.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

type Expect = "ok" | "redirect-or-ok" | "not-found-ok";
type Result = { route: string; status: number; ms: number; kb: number; problems: string[] };

const ERROR_MARKERS: [RegExp, string][] = [
  [/Bir şeyler ters gitti/, "hata siniri gorundu"],
  [/Application error/i, "Next 'Application error'"],
  [/Internal Server Error/i, "500 metni"],
  [/Bugünün listesi yüklenemedi/, "dashboard veri hatasi"],
];

async function visit(cookie: string, route: string, expect: Expect = "ok"): Promise<Result> {
  const t0 = performance.now();
  const problems: string[] = [];
  let status = 0;
  let kb = 0;
  try {
    const res = await fetch(BASE + route, { headers: { cookie }, redirect: "manual", signal: AbortSignal.timeout(20_000) });
    status = res.status;
    const body = await res.text();
    kb = Math.round(body.length / 1024);
    if (status >= 500) problems.push(`HTTP ${status}`);
    if (expect === "ok" && status !== 200) problems.push(`beklenen 200, gelen ${status}`);
    if (expect === "redirect-or-ok" && ![200, 307, 308, 302].includes(status)) problems.push(`beklenmeyen ${status}`);
    if (expect === "not-found-ok" && ![200, 404, 307].includes(status)) problems.push(`beklenmeyen ${status}`);
    for (const [re, label] of ERROR_MARKERS) if (re.test(body)) problems.push(label);
    // Akisli (streaming) yanitta redirect()/notFound() de "digest" olarak gorunur - bunlar BEKLENEN akis
    // kontrolu (yonlendirme / 404). Sayisal-hash digest'ler ise GERCEK sunucu hatasidir.
    const digests = [...body.matchAll(/data-dgst="([^"]*)"/g)].map((m) => m[1]);
    digests.push(...[...body.matchAll(/\$RX\("[^"]*","([^"]*)"/g)].map((m) => m[1]));
    for (const d of digests) {
      if (!/^(NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK;(404|307|308)|NEXT_NOT_FOUND)/.test(d)) problems.push(`gercek sunucu hatasi (digest ${d.slice(0, 24)})`);
    }
  } catch (e) {
    problems.push(`istek basarisiz: ${(e as Error).message}`);
  }
  const ms = Math.round(performance.now() - t0);
  if (ms > SLOW_MS) problems.push(`yavas (${ms}ms)`);
  return { route, status, ms, kb, problems };
}

async function run(label: string, cookie: string, routes: [string, Expect?][]) {
  console.log(`\n=== ${label} ===`);
  let bad = 0;
  for (const [route, expect] of routes) {
    const r = await visit(cookie, route, expect);
    const flag = r.problems.length ? "HATA" : "ok  ";
    if (r.problems.length) bad++;
    console.log(`  ${flag} ${String(r.status).padEnd(3)} ${String(r.ms).padStart(5)}ms ${String(r.kb).padStart(5)}KB  ${route}${r.problems.length ? "   <- " + r.problems.join("; ") : ""}`);
  }
  return bad;
}

// Bozuk / uc girdiler: sayfa CÖKMEMELI (200 ya da kibar 404/yonlendirme).
const HOSTILE: [string, Expect][] = [
  ["/leads?page=999999", "ok"],
  ["/leads?page=-3", "ok"],
  ["/leads?page=abc", "ok"],
  ["/leads?status=bogus", "ok"],
  ["/leads?q=%27%22%25%5C%3B--", "ok"],
  ["/leads?q=" + encodeURIComponent("a".repeat(500)), "ok"],
  ["/reports?period=bogus", "ok"],
  ["/reports?period=1999-01", "ok"],
  ["/reports?period=2026-13", "ok"],
  ["/leads/calendar?y=abc&m=99", "ok"],
  ["/leads/calendar?y=1900&m=1", "ok"],
  ["/leads/discoveries?y=2026&m=13", "ok"],
  ["/leads/not-a-uuid", "not-found-ok"],
  ["/leads/00000000-0000-0000-0000-000000000000", "not-found-ok"],
  ["/leads/00000000-0000-0000-0000-000000000000/edit", "not-found-ok"],
  ["/yok-boyle-bir-sayfa", "not-found-ok"],
];

const COMPANY_ROUTES = (leadId: string | null): [string, Expect][] => [
  ["/dashboard", "ok"],
  ["/leads", "ok"],
  ["/leads?status=new", "ok"],
  ["/leads?status=won", "ok"],
  ["/leads?q=ahmet", "ok"],
  ["/leads/board", "ok"],
  ["/leads/followups", "ok"],
  ["/leads/overdue", "ok"],
  ["/leads/calendar", "ok"],
  ["/leads/discoveries", "ok"],
  ["/leads/new", "ok"],
  ["/sales", "ok"],
  ["/reports", "ok"],
  ["/reports?period=2026-10", "ok"],
  ["/agent", "ok"],
  ["/settings", "ok"],
  ...(leadId ? ([[`/leads/${leadId}`, "ok"], [`/leads/${leadId}/edit`, "ok"]] as [string, Expect][]) : []),
];

const ADMIN_ROUTES = (prospectId: string | null): [string, Expect][] => [
  ["/admin/companies", "ok"],
  ["/admin/users", "ok"],
  ["/admin/audit", "ok"],
  ["/admin/integrations", "ok"],
  ["/admin/prospects", "ok"],
  ["/admin/prospects/followups", "ok"],
  ["/admin/prospects/overdue", "ok"],
  ["/admin/prospects/calendar", "ok"],
  ["/admin/prospects/playbook", "ok"],
  ...(prospectId ? ([[`/admin/prospects/${prospectId}`, "ok"]] as [string, Expect][]) : []),
  // Admin firma sayfalarina girerse yonlendirilmeli (cokmemeli):
  ["/dashboard", "redirect-or-ok"],
  ["/leads", "redirect-or-ok"],
];

let totalBad = 0;

// 1) Firma sahibi (5.000 leadlik dolu firma)
const { data: leadRow } = await admin.from("leads").select("id").eq("company_id", creds.companyId).limit(1).maybeSingle();
const ownerCookie = await login(creds.ownerEmail, creds.ownerPassword);
if (ownerCookie) {
  totalBad += await run("FIRMA SAHIBI (dolu firma)", ownerCookie, COMPANY_ROUTES(leadRow?.id ?? null));
  totalBad += await run("FIRMA SAHIBI - bozuk girdiler", ownerCookie, HOSTILE);
  // Firma sahibi admin sayfalarina girerse cokmeden yonlenmeli:
  totalBad += await run("FIRMA SAHIBI - yetkisiz admin sayfalari", ownerCookie, [
    ["/admin/companies", "redirect-or-ok"],
    ["/admin/users", "redirect-or-ok"],
    ["/admin/prospects", "redirect-or-ok"],
  ]);
}

// 2) Satis personeli (RLS ile kisitli)
const salesCookie = await login(creds.salesEmails[0], creds.salesPassword ?? creds.ownerPassword);
if (salesCookie) totalBad += await run("SATIS PERSONELI", salesCookie, COMPANY_ROUTES(null));

// 3) Ajans admin
const { data: prospectRow } = await admin.from("agency_prospects").select("id").limit(1).maybeSingle();
const adminCookie = await login(creds.adminEmail, creds.adminPassword);
if (adminCookie) totalBad += await run("AJANS ADMIN", adminCookie, ADMIN_ROUTES(prospectRow?.id ?? null));

// 4) Bos firma (hic lead/satis/takip yok) - sifira bolme, bos dizi max() vb. cokme kaynagi
const stamp = Date.now();
const emptyEmail = `smoke_empty_${stamp}@example.com`;
const emptyPassword = "Smoke-" + stamp + "-aZ9";
let emptyCompanyId: string | null = null;
let emptyUserId: string | null = null;
try {
  const { data: co, error: coErr } = await admin.from("companies").insert({ name: `SmokeEmpty ${stamp}`, city: "Ankara" }).select("id").single();
  if (coErr) throw new Error(coErr.message);
  emptyCompanyId = co.id;
  const { data: u, error: uErr } = await admin.auth.admin.createUser({
    email: emptyEmail,
    password: emptyPassword,
    email_confirm: true,
    app_metadata: { role: "owner", company_id: co.id },
    user_metadata: { full_name: "Bos Firma Sahibi" },
  });
  if (uErr) throw new Error(uErr.message);
  emptyUserId = u.user.id;
  const emptyCookie = await login(emptyEmail, emptyPassword);
  if (emptyCookie) {
    totalBad += await run("BOS FIRMA (hic verisi olmayan yeni musteri)", emptyCookie, COMPANY_ROUTES(null));
    totalBad += await run("BOS FIRMA - bozuk girdiler", emptyCookie, HOSTILE.slice(0, 12));
  }
} catch (e) {
  console.log("  bos firma senaryosu kurulamadi:", (e as Error).message);
  totalBad++;
} finally {
  if (emptyUserId) await admin.auth.admin.deleteUser(emptyUserId);
  if (emptyCompanyId) await admin.from("companies").delete().eq("id", emptyCompanyId);
}

console.log(totalBad === 0 ? "\nSONUC: TUM SAYFALAR SAGLAM" : `\nSONUC: ${totalBad} SAYFADA SORUN VAR`);
process.exit(totalBad === 0 ? 0 : 1);
