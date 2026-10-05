/**
 * DOGRULAMA ARACI - "yeni hesap actim ama icinde leadler var" karisikliginin
 * iki yolunu BIREBIR dener (admin panelindeki iki form ile ayni Auth cagrilari):
 *
 *   A) Firmalar -> "Yeni Firma Ekle"  (createCompanyWithOwnerAction)
 *      => yeni firma + yeni owner  => hesap TAMAMEN BOS olmali (0 lead).
 *   B) Kullanicilar -> "Mevcut Firmaya Kullanici Ekle" (createCompanyUserAction)
 *      => var olan firmanin owner'i => o firmanin TUM leadlerini gormeli (beklenen).
 *   C) Admin icin agency_company_stats (formdaki "mevcut N lead" uyarisinin
 *      kaynagi) iki firmada da dogru sayiyi vermeli.
 *   D) Yeni (bos) firmanin hesabi baska firmanin hicbir satirini goremez.
 *
 * Olusan tum kayitlar sonunda silinir. SADECE .env.perftest.local'deki izole
 * test projesine karsi calisir (production'a karsi calismayi REDDEDER).
 *
 *   npx tsx scripts/verify-tenant-isolation.mts
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.perftest.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const creds = JSON.parse(fs.readFileSync(".perftest-credentials.json", "utf8")) as {
  companyId: string;
  adminEmail: string;
  adminPassword: string;
};

const PROD_REF = "dhnwcvirgnkpnlrurdap";
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
if (!URL_ || !env.SUPABASE_SECRET_KEY || env.SUPABASE_PROJECT_REF === PROD_REF || URL_.includes(PROD_REF)) {
  console.error("DURDURULDU: test projesi ayarlari eksik ya da PRODUCTION'a isaret ediyor.");
  process.exit(2);
}

const service = createClient(URL_, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = () =>
  createClient(URL_, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "HATA"} ${label}${detail ? ` -> ${detail}` : ""}`);
};

const strongPassword = () => `Aa1-${crypto.randomBytes(9).toString("hex")}`;
const stamp = Date.now();
const createdUserIds: string[] = [];
let newCompanyId: string | null = null;

let actorId = "";

async function createUser(email: string, role: "owner" | "sales", companyId: string) {
  const password = strongPassword();
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role, company_id: companyId, created_by: actorId },
    user_metadata: { full_name: "Deneme Kullanici" },
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  createdUserIds.push(data.user.id);
  return { id: data.user.id, email, password };
}

async function signedIn(email: string, password: string) {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return c;
}

try {
  // `created_by` bir UUID olmali (audit tetikleyicisi uuid'ye cevirir) - panelde bu, giris yapmis admin'in kimligidir.
  const { data: adminProfile } = await service.from("profiles").select("id").eq("email", creds.adminEmail).maybeSingle();
  if (!adminProfile) throw new Error("test admin profili bulunamadi");
  actorId = adminProfile.id;

  // Olcut: PerfTest Firma gercekten dolu mu?
  const { count: perfLeads } = await service.from("leads").select("id", { count: "exact", head: true }).eq("company_id", creds.companyId);
  check("PerfTest Firma dolu (kontrol)", (perfLeads ?? 0) > 1000, `${perfLeads} lead`);

  // --- A) Yeni Firma Ekle ----------------------------------------------------
  const { data: company, error: cErr } = await service
    .from("companies")
    .insert({ name: `ZZ Deneme Firma ${stamp}` })
    .select("id")
    .single();
  if (cErr || !company) throw new Error(`company: ${cErr?.message}`);
  newCompanyId = company.id;
  const freshOwner = await createUser(`zz-fresh-${stamp}@example.com`, "owner", company.id);
  const fresh = await signedIn(freshOwner.email, freshOwner.password);

  const { count: freshLeads } = await fresh.from("leads").select("id", { count: "exact", head: true });
  check("A) yeni firma sahibi: lead sayisi 0", freshLeads === 0, `${freshLeads} lead`);
  const { count: freshActs } = await fresh.from("activities").select("id", { count: "exact", head: true });
  check("A) yeni firma sahibi: aktivite sayisi 0", freshActs === 0, `${freshActs}`);
  const { count: freshSales } = await fresh.from("sales").select("id", { count: "exact", head: true });
  check("A) yeni firma sahibi: satis sayisi 0", freshSales === 0, `${freshSales}`);
  const { data: freshCompanies } = await fresh.from("companies").select("id");
  check("D) yeni firma sahibi yalniz KENDI firmasini gorur", freshCompanies?.length === 1 && freshCompanies[0].id === company.id, `${freshCompanies?.length} firma`);
  const { data: freshProfiles } = await fresh.from("profiles").select("id");
  check("D) yeni firma sahibi baska firmanin kullanicisini gormez", (freshProfiles ?? []).length === 1, `${freshProfiles?.length} profil`);

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  const { data: today, error: tErr } = await fresh.rpc("dashboard_today", {
    p_now: now.toISOString(),
    p_day_start: dayStart.toISOString(),
    p_day_end: dayEnd.toISOString(),
    p_month_start: dayStart.toISOString().slice(0, 7) + "-01",
    p_month_end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10),
  });
  const counts = (today as { counts?: Record<string, number> } | null)?.counts;
  check(
    "A) yeni firma Bugun ekrani: geciken/takip/yeni hepsi 0",
    !tErr && !!counts && counts.overdue === 0 && counts.due === 0 && counts.new === 0,
    tErr ? tErr.message : JSON.stringify(counts)
  );

  // --- B) Mevcut firmaya kullanici ekle -------------------------------------
  const extraOwner = await createUser(`zz-extra-${stamp}@example.com`, "owner", creds.companyId);
  const extra = await signedIn(extraOwner.email, extraOwner.password);
  const { count: extraLeads } = await extra.from("leads").select("id", { count: "exact", head: true });
  check("B) mevcut firmaya eklenen owner o firmanin TUM leadlerini gorur (beklenen davranis)", extraLeads === perfLeads, `${extraLeads}/${perfLeads}`);

  // --- C) Admin formundaki uyari sayisi -------------------------------------
  const admin = await signedIn(creds.adminEmail, creds.adminPassword);
  const { data: stats, error: sErr } = await admin.rpc("agency_company_stats");
  const perfRow = stats?.find((r: { id: string }) => r.id === creds.companyId);
  const freshRow = stats?.find((r: { id: string }) => r.id === company.id);
  check("C) admin listesinde PerfTest Firma lead sayisi dogru", !sErr && Number(perfRow?.lead_count) === perfLeads, `${perfRow?.lead_count}`);
  check("C) admin listesinde yeni firma lead sayisi 0 (satir var)", !!freshRow && Number(freshRow.lead_count) === 0, `${freshRow?.lead_count}`);
} catch (e) {
  failures++;
  console.error("BEKLENMEYEN HATA:", e instanceof Error ? e.message : e);
} finally {
  // Temizlik: olusturdugumuz her sey silinir.
  for (const id of createdUserIds) {
    const { error } = await service.auth.admin.deleteUser(id);
    if (error) console.error("silinemedi (kullanici):", id, error.message);
  }
  if (newCompanyId) {
    await service.from("product_categories").delete().eq("company_id", newCompanyId);
    const { error } = await service.from("companies").delete().eq("id", newCompanyId);
    if (error) console.error("silinemedi (firma):", error.message);
  }
  const { count: leftUsers } = await service.from("profiles").select("id", { count: "exact", head: true }).like("email", "zz-%-" + stamp + "@example.com");
  const { count: leftCompanies } = await service.from("companies").select("id", { count: "exact", head: true }).like("name", "ZZ Deneme Firma%");
  check("temizlik: test kullanicilari silindi", leftUsers === 0, `${leftUsers}`);
  check("temizlik: test firmasi silindi", leftCompanies === 0, `${leftCompanies}`);
}

console.log(failures === 0 ? "\nSONUC: TUM KONTROLLER GECTI" : `\nSONUC: ${failures} KONTROL BASARISIZ`);
process.exit(failures === 0 ? 0 : 1);
