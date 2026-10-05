#!/usr/bin/env node
/**
 * VERI YEDEGI (mantiksal dokum)
 *
 * Supabase projesinde otomatik gunluk yedek / PITR KAPALI (Free plan). Bu betik CANLI
 * projenin tum `public` tablolarini JSON dosyalarina yazar:  backups/<tarih-saat>/<tablo>.json
 * (+ auth kullanici listesi: e-posta/rol/olusturma - PAROLA HASH'I YOK)
 * (+ manifest.json: hangi proje, ne zaman, tablo basina satir sayisi).
 *
 *   npm run backup
 *
 * - Sema zaten `supabase/migrations` icinde (git). Bu betik VERIYI yedekler.
 * - `backups/` .gitignore'da: icinde kisisel veri (musteri adi/telefon) VAR - asla commit etme.
 * - Geri yukleme: ilgili tabloya service_role ile `insert`/`upsert` (FK sirasi: companies ->
 *   profiles -> product_categories/salespeople -> leads -> activities/followups/sales/
 *   discovery_visits; agency_* bagimsiz).
 * - IKINCI KOPYA: yedek klasoru ayrica tek dosya (.tar.gz) olarak canli projedeki OZEL
 *   (public olmayan) "db-backups" Storage kovasina yuklenir - bu Mac bozulursa/kaybolursa
 *   kopya kalir. Kovaya yalnizca service_role erisir (politika yok = anon/authenticated
 *   okuyamaz). Geri almak icin: Supabase paneli -> Storage -> db-backups -> indir -> ac.
 *   SINIR: kopya veritabaniyla AYNI Supabase hesabinda; proje/hesap kaybina karsi koruyan
 *   bu Mac'teki yereldir. Ikisinden bagimsiz kalici cozum: Supabase Pro (gunluk yedek + PITR).
 *
 * KOK NEDEN DUZELTMESI (2026-10-05): bu betik eskiden `.env.local`'i okuyordu. Yerel
 * gelistirme izole TEST projesine cevrilince (.env.local -> test, canli ayarlar ->
 * .env.production-backup.local) gecelik yedek 02-05 Ekim arasinda sessizce TEST verisini
 * (PerfTest Firma, 5000 sahte lead) yedekledi; canli veri yedeklenmedi. Ayrica ag
 * hatasinda yarim/bos klasor birakiyordu (02 ve 04 Ekim). Artik:
 *  1) canli ayar dosyasi once okunur (BACKUP_ENV_FILE ile degistirilebilir),
 *  2) hedef canli proje degilse betik DURUR (bilerek test yedegi: BACKUP_ALLOW_NON_PROD=1,
 *     klasor adi "-TEST" ile biter),
 *  3) ag hatalari tekrar denenir; yedek gecici klasore yazilir ve ANCAK tamamlaninca
 *     asil adina tasinir - backups/ altinda yarim yedek kalmaz.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

/** Canli (production) Supabase projesi. */
const PROD_REF = "dhnwcvirgnkpnlrurdap";
/** Ikinci kopyanin yuklendigi OZEL Storage kovasi (canli projede). */
const OFFSITE_BUCKET = "db-backups";

const envFile = process.env.BACKUP_ENV_FILE ?? [".env.production-backup.local", ".env.local"].find((f) => fs.existsSync(f));
if (!envFile || !fs.existsSync(envFile)) {
  console.error("HATA: ayar dosyasi bulunamadi (.env.production-backup.local ya da .env.local).");
  process.exit(1);
}

const env = {};
fs.readFileSync(envFile, "utf8")
  .split("\n")
  .forEach((line) => {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  });

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
  console.error(`HATA: ${envFile} icinde NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY eksik.`);
  process.exit(1);
}

const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const isProd = projectRef === PROD_REF;
if (!isProd && process.env.BACKUP_ALLOW_NON_PROD !== "1") {
  console.error(
    `HATA: ${envFile} CANLI projeyi (${PROD_REF}) degil "${projectRef}" projesini gosteriyor - yedek ALINMADI.\n` +
      "Canli ayarlari .env.production-backup.local dosyasina koyun ya da BACKUP_ENV_FILE ile gosterin."
  );
  process.exit(1);
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// FK sirasina gore (geri yuklerken bu sirayla ekle).
const TABLES = [
  "companies",
  "profiles",
  "product_categories",
  "salespeople",
  "integrations",
  "competitors",
  "leads",
  "activities",
  "followups",
  "sales",
  "discovery_visits",
  "ai_reports",
  "agency_prospects",
  "agency_prospect_activities",
  "audit_log",
];
const PAGE = 1000;
/** Ag hatasinda (gece uyanan Mac'te ag henuz hazir olmayabilir) bekleme sureleri, sn. */
const RETRY_DELAYS_S = [2, 5, 15, 30, 60];

/** Supabase cagrisini ag/gecici hatalarda tekrar dener; son denemenin sonucunu dondurur. */
async function withRetry(label, run) {
  for (let attempt = 0; ; attempt++) {
    let message;
    try {
      const result = await run();
      if (!result.error) return result;
      if (attempt >= RETRY_DELAYS_S.length) return result;
      message = result.error.message;
    } catch (e) {
      if (attempt >= RETRY_DELAYS_S.length) throw e;
      message = e instanceof Error ? e.message : String(e);
    }
    console.error(`UYARI ${label}: ${message} - ${RETRY_DELAYS_S[attempt]} sn sonra tekrar (${attempt + 1}/${RETRY_DELAYS_S.length})`);
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_S[attempt] * 1000));
  }
}

const startedAt = new Date();
const stamp = startedAt.toISOString().replace(/[:T]/g, "-").slice(0, 16);
const finalDir = path.join("backups", isProd ? stamp : `${stamp}-TEST`);
const dir = path.join("backups", `.yarim-${stamp}`);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

const fail = (message) => {
  console.error(message);
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(1);
};

console.log(`Kaynak proje: ${projectRef}${isProd ? " (CANLI)" : " (TEST - canli DEGIL)"}  ayar: ${envFile}`);

const counts = {};
let total = 0;
for (const table of TABLES) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await withRetry(table, () =>
      supabase.from(table).select("*").order("id", { ascending: true }).range(from, from + PAGE - 1)
    );
    if (error) fail(`HATA ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  fs.writeFileSync(path.join(dir, `${table}.json`), JSON.stringify(rows, null, 1), { mode: 0o600 });
  counts[table] = rows.length;
  total += rows.length;
  console.log(`${table.padEnd(28)} ${String(rows.length).padStart(6)} satir`);
}

const { data: users, error: usersError } = await withRetry("auth.users", () => supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }));
if (usersError) fail(`HATA auth.users: ${usersError.message}`);
fs.writeFileSync(
  path.join(dir, "auth_users.json"),
  JSON.stringify(users.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, app_metadata: u.app_metadata, banned_until: u.banned_until ?? null })), null, 1),
  { mode: 0o600 }
);

fs.writeFileSync(
  path.join(dir, "manifest.json"),
  JSON.stringify(
    { project_ref: projectRef, is_production: isProd, started_at: startedAt.toISOString(), finished_at: new Date().toISOString(), total_rows: total, auth_users: users.users.length, tables: counts },
    null,
    1
  ),
  { mode: 0o600 }
);

// Ayni dakikada ikinci calistirma: eskisinin uzerine yazmak yerine saniye ekle.
const target = fs.existsSync(finalDir) ? `${finalDir}-${String(startedAt.getUTCSeconds()).padStart(2, "0")}` : finalDir;
fs.renameSync(dir, target);

console.log(`\nYedek tamam: ${target}  (${total} satir, ${users.users.length} kullanici). Bu klasor kisisel veri icerir - guvenli sakla.`);

// IKINCI KOPYA (yalnizca canli yedek). Yerel yedek bu noktada TAMAM; yukleme basarisiz
// olursa yerel yedek gecerlidir ama betik hata koduyla biter (gece gorevi bildirim verir).
if (isProd && process.env.BACKUP_SKIP_OFFSITE !== "1") {
  const name = `${path.basename(target)}.tar.gz`;
  const archive = path.join(os.tmpdir(), `iklimlen-${process.pid}-${name}`);
  try {
    // COPYFILE_DISABLE: macOS tar'i "._" (AppleDouble) dosyalari eklemesin.
    execFileSync("tar", ["-czf", archive, "-C", "backups", path.basename(target)], { env: { ...process.env, COPYFILE_DISABLE: "1" } });
    const body = fs.readFileSync(archive);

    // Tekrar denenmez: ilk calistirmada "kova yok" beklenen sonuctur (ag az once calisiyordu).
    const { error: bucketError } = await supabase.storage.getBucket(OFFSITE_BUCKET);
    if (bucketError) {
      const { error: createError } = await supabase.storage.createBucket(OFFSITE_BUCKET, { public: false });
      if (createError) throw new Error(`kova olusturulamadi: ${createError.message}`);
      console.log(`Ozel Storage kovasi olusturuldu: ${OFFSITE_BUCKET}`);
    }
    const { data: bucket } = await supabase.storage.getBucket(OFFSITE_BUCKET);
    if (bucket?.public) throw new Error(`"${OFFSITE_BUCKET}" kovasi PUBLIC - kisisel veri yuklenmedi. Kovayi ozel yapin.`);

    const { error: uploadError } = await withRetry("storage.upload", () =>
      supabase.storage.from(OFFSITE_BUCKET).upload(name, body, { contentType: "application/gzip", upsert: false })
    );
    if (uploadError) throw new Error(uploadError.message);
    console.log(`Ikinci kopya yuklendi: Storage/${OFFSITE_BUCKET}/${name}  (${(body.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.error(`HATA ikinci kopya (Supabase Storage) yuklenemedi: ${e instanceof Error ? e.message : e}\nYerel yedek GECERLI: ${target}`);
    process.exitCode = 1;
  } finally {
    fs.rmSync(archive, { force: true });
  }
}
