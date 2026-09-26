#!/usr/bin/env node
/**
 * VERI YEDEGI (mantiksal dokum)
 *
 * Supabase projesinde otomatik gunluk yedek / PITR KAPALI (Free plan). Bu betik tum
 * `public` tablolarini JSON dosyalarina yazar:  backups/<tarih-saat>/<tablo>.json
 * (+ auth kullanici listesi: e-posta/rol/olusturma - PAROLA HASH'I YOK).
 *
 *   npm run backup
 *
 * - Sema zaten `supabase/migrations` icinde (git). Bu betik VERIYI yedekler.
 * - `backups/` .gitignore'da: icinde kisisel veri (musteri adi/telefon) VAR - asla commit etme.
 * - Geri yukleme: ilgili tabloya service_role ile `insert`/`upsert` (FK sirasi: companies ->
 *   profiles -> product_categories/salespeople -> leads -> activities/followups/sales/
 *   discovery_visits; agency_* bagimsiz).
 * - Onerilen: haftalik cron/launchd + yedegi baska bir konuma (sifreli disk/bulut) kopyala.
 *   Kalici cozum: Supabase Pro plana gecip gunluk otomatik yedek + PITR acmak.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const env = {};
fs.readFileSync(".env.local", "utf8")
  .split("\n")
  .forEach((line) => {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  });

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

const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
const dir = path.join("backups", stamp);
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

let total = 0;
for (const table of TABLES) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select("*").order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) {
      console.error(`HATA ${table}: ${error.message}`);
      process.exit(1);
    }
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  fs.writeFileSync(path.join(dir, `${table}.json`), JSON.stringify(rows, null, 1), { mode: 0o600 });
  total += rows.length;
  console.log(`${table.padEnd(28)} ${String(rows.length).padStart(6)} satir`);
}

const { data: users, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (usersError) {
  console.error(`HATA auth.users: ${usersError.message}`);
  process.exit(1);
}
fs.writeFileSync(
  path.join(dir, "auth_users.json"),
  JSON.stringify(users.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, app_metadata: u.app_metadata, banned_until: u.banned_until ?? null })), null, 1),
  { mode: 0o600 }
);

console.log(`\nYedek tamam: ${dir}  (${total} satir, ${users.users.length} kullanici). Bu klasor kisisel veri icerir - guvenli sakla.`);
