#!/usr/bin/env node
/**
 * YARIM KALMIS HESAP ONARIMI
 *
 * Profil satiri olmayan (giris yapabilen ama hicbir yetkisi olmayan) auth kullanicilarini listeler.
 * Tipik neden: migration 0026'dan SONRA, henuz guncellenmemis ESKI panel kodu `createUser`'i rol/firmayi
 * `user_metadata`'da gondererek calistirdi (yeni tetikleyici artik yalnizca `app_metadata`'ya guvenir).
 *
 *   node scripts/fix-orphan-users.mjs            # sadece listeler (degisiklik yapmaz)
 *   node scripts/fix-orphan-users.mjs --apply    # user_metadata'daki role/company_id'yi app_metadata'ya tasir -> profil olusur
 *
 * GUVENLIK: bu betik YALNIZCA sizin (ajans admini) makinenizde, service_role ile calisir; kullanici
 * girdisine guvenmez ama Admin API ile olusturulan hesaplarin metadata'sina guvenir - bu yuzden
 * listeyi once elle inceleyin. 'admin' rolu ASLA otomatik verilmez.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
fs.readFileSync(".env.local", "utf8")
  .split("\n")
  .forEach((line) => {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  });
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const apply = process.argv.includes("--apply");

const { data: usersRes, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (error) throw new Error(error.message);
const { data: profiles } = await admin.from("profiles").select("id");
const { data: companies } = await admin.from("companies").select("id, name");
const hasProfile = new Set((profiles ?? []).map((p) => p.id));
const companyName = new Map((companies ?? []).map((c) => [c.id, c.name]));

const orphans = usersRes.users.filter((u) => !hasProfile.has(u.id));
if (orphans.length === 0) {
  console.log("Yarim kalmis hesap yok.");
  process.exit(0);
}

for (const u of orphans) {
  const role = u.user_metadata?.role;
  const companyId = u.user_metadata?.company_id;
  const fixable = (role === "owner" || role === "sales") && companyName.has(companyId);
  console.log(`${u.email}  olusturma=${u.created_at?.slice(0, 16)}  metadata: rol=${role ?? "-"} firma=${companyName.get(companyId) ?? companyId ?? "-"}  ${fixable ? "-> ONARILABILIR" : "-> onarilamaz (elle inceleyin)"}`);
  if (apply && fixable) {
    const { error: upErr } = await admin.auth.admin.updateUserById(u.id, { app_metadata: { ...u.app_metadata, role, company_id: companyId } });
    const { data: p } = await admin.from("profiles").select("id").eq("id", u.id).maybeSingle();
    console.log(upErr ? `   HATA: ${upErr.message}` : p ? "   onarildi (profil olustu)" : "   uyari: profil olusmadi");
  }
}
if (!apply) console.log("\nOnarmak icin: node scripts/fix-orphan-users.mjs --apply");
