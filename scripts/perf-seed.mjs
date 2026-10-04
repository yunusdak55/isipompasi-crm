#!/usr/bin/env node
/**
 * PERFORMANS DENETIMI - sentetik yuk uretici.
 *
 * SADECE .env.perftest.local'deki IZOLE test projesine karsi calisir - gercek
 * (production) projeye karsi calismayi REDDEDER (asagidaki guvenlik kontrolu).
 * 5.000 lead, ~20.000 not (activities), 2.000 randevu (followups) uretir.
 *
 *   node scripts/perf-seed.mjs
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env = {};
fs.readFileSync(".env.perftest.local", "utf8")
  .split("\n")
  .forEach((line) => {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  });

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = env.SUPABASE_SECRET_KEY;
const REF = env.SUPABASE_PROJECT_REF;

// GUVENLIK: production proje ref'i ile ASLA calismasin (yanlislikla yapistirilan
// bir .env.local durumunda gercek veriyi kirletmesin).
const PROD_REF = "dhnwcvirgnkpnlrurdap";
if (!URL_ || !SECRET || !REF) {
  console.error("Eksik .env.perftest.local - once scripts/perf-seed.mjs'i NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SECRET_KEY/SUPABASE_PROJECT_REF ile doldurun.");
  process.exit(2);
}
if (REF === PROD_REF || URL_.includes(PROD_REF)) {
  console.error("DURDURULDU: Bu script PRODUCTION projesine karsi calismayi reddeder.");
  process.exit(2);
}

const admin = createClient(URL_, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });

const CITIES = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Konya", "Gaziantep", "Kayseri", "Samsun", "Eskişehir", "Mersin"];
const FIRST = ["Ahmet", "Mehmet", "Mustafa", "Ali", "Hüseyin", "Hasan", "İbrahim", "Osman", "Yusuf", "Murat", "Ayşe", "Fatma", "Emine", "Hatice", "Zeynep", "Elif", "Meryem", "Şule", "Özlem", "Derya"];
const LAST = ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Yıldırım", "Öztürk", "Aydın", "Özdemir", "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin"];
const STATUSES = ["new", "discovery_offer", "followup", "won", "lost"];
const STATUS_WEIGHTS = [0.3, 0.22, 0.2, 0.18, 0.1];
const PRIORITIES = ["hot", "cold"];
const SOURCES = ["instagram", "google_ads", "referans", "whatsapp", "web_formu", null];

function weightedPick(items, weights) {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < items.length; i++) {
    acc += weights[i];
    if (r <= acc) return items[i];
  }
  return items[items.length - 1];
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randPhone = (i) => `5${String(300000000 + i).slice(0, 9)}`;
const randDateWithin = (daysBack) => new Date(Date.now() - Math.random() * daysBack * 86400000).toISOString();
const randFutureDate = (daysFwd) => new Date(Date.now() + (Math.random() * 2 - 0.3) * daysFwd * 86400000).toISOString();

async function insertBatched(table, rows, batchSize = 500) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error, data } = await admin.from(table).insert(batch).select("id");
    if (error) throw new Error(`${table} batch ${i}: ${error.message}`);
    inserted += data.length;
    process.stdout.write(`\r${table}: ${inserted}/${rows.length}`);
  }
  console.log("");
  return inserted;
}

async function main() {
  console.log("=== PerfTest fixture kuruluyor ===");
  const { data: company, error: coErr } = await admin.from("companies").insert({ name: "PerfTest Firma", city: "İstanbul" }).select("id").single();
  if (coErr) throw new Error(coErr.message);
  const companyId = company.id;
  console.log("Firma:", companyId);

  const ownerEmail = "perftest_owner@example.com";
  const ownerPassword = crypto.randomBytes(18).toString("base64url") + "aZ9";
  const { error: ownerErr } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: ownerPassword,
    email_confirm: true,
    app_metadata: { role: "owner", company_id: companyId },
    user_metadata: { full_name: "PerfTest Owner" },
  });
  if (ownerErr) throw new Error(ownerErr.message);
  console.log("Owner hesabi olusturuldu:", ownerEmail, "(sifre .perftest-credentials.json dosyasina yazilacak, burada gosterilmiyor)");

  const salespeopleProfiles = [];
  for (let i = 0; i < 5; i++) {
    const email = `perftest_sales${i}@example.com`;
    const pw = crypto.randomBytes(18).toString("base64url") + "aZ9";
    const { data: u, error } = await admin.auth.admin.createUser({
      email,
      password: pw,
      email_confirm: true,
      app_metadata: { role: "sales", company_id: companyId },
      user_metadata: { full_name: `${pick(FIRST)} ${pick(LAST)}` },
    });
    if (error) throw new Error(error.message);
    salespeopleProfiles.push(u.user.id);
  }
  console.log("Satis personeli (profiles):", salespeopleProfiles.length);

  const { data: cats } = await admin
    .from("product_categories")
    .insert([
      { company_id: companyId, label: "Isı Pompası", sort_order: 0 },
      { company_id: companyId, label: "Klima", sort_order: 1 },
      { company_id: companyId, label: "VRF/VRV Sistemi", sort_order: 2 },
      { company_id: companyId, label: "Diğer", sort_order: 3 },
    ])
    .select("id");
  const catIds = cats.map((c) => c.id);

  // -------------------------------------------------------------- leads
  const LEAD_COUNT = 5000;
  const leadRows = Array.from({ length: LEAD_COUNT }, (_, i) => {
    const status = weightedPick(STATUSES, STATUS_WEIGHTS);
    const createdAt = randDateWithin(180);
    return {
      company_id: companyId,
      first_name: pick(FIRST),
      last_name: pick(LAST),
      phone: randPhone(i),
      city: pick(CITIES),
      status,
      priority: pick(PRIORITIES),
      product_category_id: Math.random() < 0.85 ? pick(catIds) : null,
      assigned_salesperson: Math.random() < 0.8 ? pick(salespeopleProfiles) : null,
      offered_amount: Math.random() < 0.6 ? Math.round(Math.random() * 180000 + 20000) : null,
      source: pick(SOURCES),
      created_at: createdAt,
      last_activity_at: createdAt,
      next_followup_at: status === "followup" ? randFutureDate(14) : null,
    };
  });
  const leadIds = [];
  for (let i = 0; i < leadRows.length; i += 500) {
    const batch = leadRows.slice(i, i + 500);
    const { data, error } = await admin.from("leads").insert(batch).select("id, status");
    if (error) throw new Error(`leads batch ${i}: ${error.message}`);
    leadIds.push(...data.map((d) => d.id));
    process.stdout.write(`\rleads: ${leadIds.length}/${LEAD_COUNT}`);
  }
  console.log("");

  // ---------------------------------------------------------- activities (notlar)
  const NOTE_COUNT = 20000;
  const NOTE_TEXTS = [
    "Aradım, uygun zamanda tekrar görüşeceğiz.",
    "Fiyat bilgisi verildi, düşünüyor.",
    "Keşif planlandı.",
    "Ulaşılamadı, tekrar denenecek.",
    "İlgileniyor, teklif bekliyor.",
    "Rakip firmalarla da görüşüyor.",
    "Bütçe netleşince dönecek.",
    "Montaj tarihi konuşuldu.",
  ];
  const noteRows = Array.from({ length: NOTE_COUNT }, () => ({
    company_id: companyId,
    lead_id: pick(leadIds),
    type: "note",
    description: pick(NOTE_TEXTS),
    created_at: randDateWithin(180),
  }));
  await insertBatched("activities", noteRows, 1000);

  // ---------------------------------------------------------- followups (randevular)
  const FOLLOWUP_COUNT = 2000;
  const followupRows = Array.from({ length: FOLLOWUP_COUNT }, () => ({
    company_id: companyId,
    lead_id: pick(leadIds),
    followup_date: randFutureDate(21),
    note: pick(NOTE_TEXTS),
    is_completed: Math.random() < 0.3,
  }));
  await insertBatched("followups", followupRows, 1000);

  console.log("\n=== TAMAMLANDI ===");
  console.log(JSON.stringify({ companyId, leadCount: leadIds.length, noteCount: NOTE_COUNT, followupCount: FOLLOWUP_COUNT }, null, 2));
  fs.writeFileSync(
    ".perftest-credentials.json",
    JSON.stringify({ companyId, ownerEmail, ownerPassword, salesEmails: Array.from({ length: 5 }, (_, i) => `perftest_sales${i}@example.com`) }, null, 2)
  );
  console.log("Giris bilgileri .perftest-credentials.json dosyasina yazildi (gitignore'da).");
}

main().catch((e) => {
  console.error("HATA:", e.message);
  process.exit(1);
});
