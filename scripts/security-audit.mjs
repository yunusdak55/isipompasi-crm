#!/usr/bin/env node
/**
 * GUVENLIK REGRESYON TESTI
 *
 * Canli Supabase projesine karsi calisir; IZOLE, gecici iki firma + kullanici
 * olusturur (adlari "__secaudit_..."), gercek saldiri denemelerini yapar ve
 * sonunda HEPSINI siler. Mevcut hicbir gercek kayda dokunmaz.
 *
 *   npm run security:check
 *
 * Her satir PASS (saldiri engellendi) ya da FAIL (acik var). Herhangi bir FAIL
 * varsa cikis kodu 1 olur - migration / auth ayari degistirdikten sonra
 * mutlaka calistirin. Yeni bir tablo/kolon/politika eklediginizde buraya
 * ilgili saldiri denemesini de ekleyin.
 *
 * Gerekli ortam (.env.local): NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env = {};
fs.readFileSync(".env.local", "utf8")
  .split("\n")
  .forEach((line) => {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  });

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = env.SUPABASE_SECRET_KEY;
if (!URL_ || !PUB || !SECRET) {
  console.error("Eksik ortam degiskeni (.env.local): URL / PUBLISHABLE / SECRET");
  process.exit(2);
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL_, SECRET, noSession);
const anon = createClient(URL_, PUB, noSession);

const stamp = Date.now();
const tag = `__secaudit_${stamp}`;
const results = [];
const cleanupUsers = [];
const cleanupCompanies = [];

function record(severity, title, blocked, detail = "") {
  results.push({ severity, title, blocked, detail });
}

/** Saldiri "engellendi" sayilir: hata dondu VEYA hicbir satir etkilenmedi/donmedi. */
const noEffect = (res) => !!res.error || !res.data || (Array.isArray(res.data) && res.data.length === 0);

const strongPassword = () => crypto.randomBytes(18).toString("base64url") + "aZ9";

async function makeUser(label, role, companyId) {
  const email = `${tag}_${label}@example.com`;
  const meta = { full_name: `Audit ${label}`, role, company_id: companyId };
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: strongPassword(),
    email_confirm: true,
    app_metadata: { role, company_id: companyId },
    user_metadata: meta,
  });
  if (error) throw new Error(`createUser ${label}: ${error.message}`);
  cleanupUsers.push(data.user.id);
  return { id: data.user.id, email };
}

/** Sifre yazmadan, magic-link dogrulamasindan jeton alip kullanici olarak oturum acar. */
async function clientFor(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`generateLink ${email}: ${error.message}`);
  const res = await fetch(data.properties.action_link, { redirect: "manual" });
  const loc = res.headers.get("location") ?? "";
  const h = new URLSearchParams(loc.split("#")[1] ?? "");
  const client = createClient(URL_, PUB, noSession);
  const { error: sErr } = await client.auth.setSession({ access_token: h.get("access_token"), refresh_token: h.get("refresh_token") });
  if (sErr) throw new Error(`setSession ${email}: ${sErr.message}`);
  return client;
}

const isDenied = (err) => !!err && (err.code === "42501" || /permission denied|not found|Could not find/i.test(err.message ?? ""));

async function main() {
  // ---------------------------------------------------------------- fixture
  const { data: coA } = await admin.from("companies").insert({ name: `${tag}_A` }).select("id").single();
  const { data: coB } = await admin.from("companies").insert({ name: `${tag}_B` }).select("id").single();
  cleanupCompanies.push(coA.id, coB.id);

  const ownerA = await makeUser("ownerA", "owner", coA.id);
  const salesA = await makeUser("salesA", "sales", coA.id);
  const ownerB = await makeUser("ownerB", "owner", coB.id);

  const { data: leadA1 } = await admin
    .from("leads")
    .insert({ company_id: coA.id, first_name: "Atanmis", phone: "0000000001", assigned_salesperson: salesA.id })
    .select("id")
    .single();
  const { data: leadA2 } = await admin.from("leads").insert({ company_id: coA.id, first_name: "Atanmamis", phone: "0000000002" }).select("id").single();
  const { data: leadB1 } = await admin.from("leads").insert({ company_id: coB.id, first_name: "DigerFirma", phone: "0000000003" }).select("id").single();
  const { data: catB } = await admin.from("product_categories").insert({ company_id: coB.id, label: "B-kat" }).select("id").single();
  const { data: spB } = await admin.from("salespeople").insert({ company_id: coB.id, full_name: "B personel" }).select("id").single();

  const cOwnerA = await clientFor(ownerA.email);
  const cSalesA = await clientFor(salesA.email);

  // ------------------------------------------- 1) Kimlik / kayit (signup) yolu
  {
    const r = await fetch(`${URL_}/auth/v1/settings`, { headers: { apikey: PUB } });
    const s = await r.json();
    record("CRITICAL", "Herkese acik kayit (signup) KAPALI olmali", s.disable_signup === true, `disable_signup=${s.disable_signup}`);
    record("HIGH", "E-posta dogrulamasi ZORUNLU olmali (autoconfirm kapali)", s.mailer_autoconfirm === false, `mailer_autoconfirm=${s.mailer_autoconfirm}`);
  }
  {
    // Herkese acik kayit (signup) yolunda kullanicinin KENDI belirledigi user_metadata ile
    // ayricalik elde edilebilir mi? Ayni tetikleyici yolunu Admin API ile taklit ediyoruz
    // (kimlik dogrulanmamis + user_metadata'da rol/firma).
    const attack = async (label, opts, expect) => {
      const email = `${tag}_${label}@example.com`;
      const { data } = await admin.auth.admin.createUser({ email, password: strongPassword(), ...opts });
      if (!data?.user) return { created: false };
      cleanupUsers.push(data.user.id);
      const { data: p } = await admin.from("profiles").select("role, company_id").eq("id", data.user.id).maybeSingle();
      return { created: true, profile: p, ...expect };
    };
    const a1 = await attack("meta1", { email_confirm: false, user_metadata: { role: "admin", full_name: "Saldirgan" } });
    record("CRITICAL", "Dogrulanmamis kayit user_metadata ile ADMIN olamaz", a1.profile?.role !== "admin", `profil=${JSON.stringify(a1.profile)}`);
    const a2 = await attack("meta2", { email_confirm: true, user_metadata: { role: "admin", full_name: "Saldirgan2" } });
    record("CRITICAL", "Dogrulanmis hesap bile user_metadata ile ADMIN olamaz", a2.profile?.role !== "admin", `profil=${JSON.stringify(a2.profile)}`);
    const a3 = await attack("meta3", { email_confirm: false, user_metadata: { role: "owner", company_id: coB.id } });
    record("CRITICAL", "user_metadata ile baska firmaya OWNER olunamaz (dogrulanmamis)", a3.profile?.company_id !== coB.id, `profil=${JSON.stringify(a3.profile)}`);
    const a4 = await attack("meta4", { email_confirm: true, user_metadata: { role: "owner", company_id: coB.id } });
    record("CRITICAL", "user_metadata ile baska firmaya OWNER olunamaz (dogrulanmis)", a4.profile?.company_id !== coB.id, `profil=${JSON.stringify(a4.profile)}`);

    // Olumlu kontrol: mesru yol (app_metadata, Admin API) calisiyor mu?
    const { data: okP } = await admin.from("profiles").select("role, company_id").eq("id", ownerA.id).maybeSingle();
    record("INFO", "Admin API + app_metadata ile hesap/profil olusturma calisir (mesru islev)", okP?.role === "owner" && okP?.company_id === coA.id, `profil=${JSON.stringify(okP)}`);
  }
  {
    const { data, error } = await admin.auth.admin.createUser({ email: `${tag}_weak@example.com`, password: "abc12345", email_confirm: true });
    if (data?.user) cleanupUsers.push(data.user.id);
    record("MEDIUM", "Zayif parola (8 karakter, buyuk harf yok) reddedilmeli", !!error, error ? "reddedildi" : "KABUL EDILDI");
    const strongish = await admin.auth.admin.createUser({ email: `${tag}_weak2@example.com`, password: "abcdefghijkl", email_confirm: true });
    if (strongish.data?.user) cleanupUsers.push(strongish.data.user.id);
    record("LOW", "Buyuk harf/rakam icermeyen parola reddedilmeli", !!strongish.error, strongish.error ? "reddedildi" : "KABUL EDILDI");
  }

  // ------------------------------------------------ 2) Profil ayricalik yukseltme
  {
    await cSalesA.from("profiles").update({ role: "admin" }).eq("id", salesA.id);
    const { data: p } = await admin.from("profiles").select("role, company_id, is_active, email").eq("id", salesA.id).single();
    record("CRITICAL", "Kullanici kendi rolunu ADMIN yapamaz", p.role === "sales", `rol=${p.role}`);

    await cSalesA.from("profiles").update({ company_id: coB.id }).eq("id", salesA.id);
    const { data: p2 } = await admin.from("profiles").select("company_id").eq("id", salesA.id).single();
    record("CRITICAL", "Kullanici kendini baska firmaya tasiyamaz", p2.company_id === coA.id, `company_id=${p2.company_id}`);

    await cSalesA.from("profiles").update({ email: "spoof@evil.example" }).eq("id", salesA.id);
    const { data: p3 } = await admin.from("profiles").select("email").eq("id", salesA.id).single();
    record("LOW", "Kullanici profil e-postasini degistiremez (kimlik taklidi)", p3.email === salesA.email.toLowerCase(), `email=${p3.email}`);

    await cSalesA.auth.updateUser({ data: { role: "admin", company_id: coB.id } });
    const { data: p5 } = await admin.from("profiles").select("role, company_id").eq("id", salesA.id).single();
    record("CRITICAL", "auth.updateUser(user_metadata) ile rol/firma degistirilemez", p5.role === "sales" && p5.company_id === coA.id, `profil=${JSON.stringify(p5)}`);

    await cSalesA.from("profiles").update({ full_name: "Yeni Ad" }).eq("id", salesA.id);
    const { data: p4 } = await admin.from("profiles").select("full_name").eq("id", salesA.id).single();
    record("INFO", "Kullanici kendi adini guncelleyebilir (mesru islev bozulmadi)", p4.full_name === "Yeni Ad", `full_name=${p4.full_name}`);
  }

  // ------------------------------------------- 3) anon (giriş yapmamis) yuzeyi
  {
    const tables = ["leads", "profiles", "companies", "activities", "followups", "sales", "salespeople", "product_categories", "discovery_visits", "integrations", "competitors", "ai_reports", "agency_prospects", "agency_prospect_activities"];
    const exposed = [];
    for (const t of tables) {
      const r = await anon.from(t).select("*").limit(1);
      if (!isDenied(r.error)) exposed.push(t);
    }
    record("HIGH", "anon rolunun HICBIR tabloda yetkisi olmamali (RLS'e ek katman)", exposed.length === 0, exposed.length ? `acik: ${exposed.join(",")}` : "");

    const definers = ["current_user_role", "current_user_company_id", "handle_new_user", "handle_user_updated", "protect_profile_privileged_columns", "touch_lead_last_activity", "dashboard_stats", "agency_company_stats"];
    const open = [];
    for (const f of definers) {
      const r = await anon.rpc(f);
      if (!isDenied(r.error)) open.push(f);
    }
    record("MEDIUM", "anon rolu RPC ile hicbir fonksiyonu cagiramamali", open.length === 0, open.length ? `acik: ${open.join(",")}` : "");
  }
  {
    const trig = ["handle_new_user", "handle_user_updated", "protect_profile_privileged_columns", "touch_lead_last_activity", "set_updated_at", "set_updated_at_and_by", "current_user_role", "current_user_company_id"];
    const open = [];
    for (const f of trig) {
      const r = await cSalesA.rpc(f);
      if (!isDenied(r.error)) open.push(f);
    }
    record("MEDIUM", "Giris yapmis kullanici tetikleyici/definer fonksiyonlari RPC ile cagiramamali", open.length === 0, open.length ? `acik: ${open.join(",")}` : "");
  }

  // ---------------------------------------------------- 4) Tenant izolasyonu
  {
    const r1 = await cOwnerA.from("leads").select("id").eq("company_id", coB.id);
    const r2 = await cOwnerA.from("profiles").select("id").eq("company_id", coB.id);
    const r3 = await cOwnerA.from("companies").select("id").eq("id", coB.id);
    const r4 = await cOwnerA.from("product_categories").select("id").eq("company_id", coB.id);
    record("CRITICAL", "Firma A sahibi, Firma B'nin verisini OKUYAMAZ", [r1, r2, r3, r4].every(noEffect));

    const w1 = await cOwnerA.from("leads").insert({ company_id: coB.id, first_name: "x", phone: "1" }).select("id");
    const w2 = await cOwnerA.from("leads").update({ first_name: "HACK" }).eq("id", leadB1.id).select("id");
    const w3 = await cOwnerA.from("leads").delete().eq("id", leadB1.id).select("id");
    const { data: still } = await admin.from("leads").select("first_name").eq("id", leadB1.id).maybeSingle();
    record("CRITICAL", "Firma A sahibi, Firma B'ye YAZAMAZ/SILEMEZ", [w1, w2, w3].every(noEffect) && still?.first_name === "DigerFirma");
  }

  // ------------------------------------------ 5) Capraz-firma referans butunlugu
  {
    const a1 = await cOwnerA.from("activities").insert({ lead_id: leadB1.id, company_id: coA.id, type: "note", description: "capraz" }).select("id");
    const f1 = await cOwnerA.from("followups").insert({ lead_id: leadB1.id, company_id: coA.id, followup_date: new Date().toISOString() }).select("id");
    const d1 = await cOwnerA.from("discovery_visits").insert({ lead_id: leadB1.id, company_id: coA.id }).select("id");
    const s1 = await admin.from("sales").select("id").limit(0); // sales yazma: owner yetkili, ayri denenir
    const s2 = await cOwnerA.from("sales").insert({ lead_id: leadB1.id, company_id: coA.id, sale_amount: 1 }).select("id");
    void s1;
    record("HIGH", "Baska firmanin lead'ine aktivite eklenemez", noEffect(a1), a1.error?.message ?? "EKLENDI");
    record("HIGH", "Baska firmanin lead'ine takip eklenemez", noEffect(f1), f1.error?.message ?? "EKLENDI");
    record("HIGH", "Baska firmanin lead'ine kesif eklenemez", noEffect(d1), d1.error?.message ?? "EKLENDI");
    record("HIGH", "Baska firmanin lead'ine satis kaydi eklenemez", noEffect(s2), s2.error?.message ?? "EKLENDI");
    const { data: touched } = await admin.from("leads").select("last_activity_at").eq("id", leadB1.id).single();
    record("HIGH", "Baska firmanin lead'inin last_activity_at'i degistirilemez (definer tetikleyici)", touched.last_activity_at === null, `last_activity_at=${touched.last_activity_at}`);

    const p1 = await cOwnerA.from("leads").update({ assigned_salesperson: ownerB.id }).eq("id", leadA1.id).select("id");
    record("MEDIUM", "Lead baska firmanin kullanicisina atanamaz", noEffect(p1), p1.error?.message ?? "ATANDI");
    const p2 = await cOwnerA.from("leads").update({ product_category_id: catB.id }).eq("id", leadA1.id).select("id");
    record("MEDIUM", "Lead baska firmanin urun kategorisine baglanamaz", noEffect(p2), p2.error?.message ?? "BAGLANDI");
    const p3 = await cOwnerA.from("leads").update({ contacted_by: spB.id }).eq("id", leadA1.id).select("id");
    record("MEDIUM", "Lead baska firmanin personel kaydina baglanamaz", noEffect(p3), p3.error?.message ?? "BAGLANDI");
  }

  // Onceki bolumdeki denemeler (acik varsa) lead'i bozmus olabilir: sonraki
  // bolumlerin anlamli olmasi icin baslangic durumuna dondur.
  await admin.from("leads").update({ assigned_salesperson: salesA.id, product_category_id: null, contacted_by: null }).eq("id", leadA1.id);

  // ------------------------------------------------------- 6) Satis rolu siniri
  {
    const r1 = await cSalesA.from("leads").select("id").eq("id", leadA2.id);
    record("HIGH", "Satis personeli kendisine atanmamis lead'i GOREMEZ", noEffect(r1));
    const r2 = await cSalesA.from("leads").select("id").eq("id", leadA1.id);
    record("INFO", "Satis personeli kendine atanmis lead'i gorebilir (mesru islev)", !noEffect(r2));
    const w1 = await cSalesA.from("leads").update({ assigned_salesperson: ownerA.id }).eq("id", leadA1.id).select("id");
    record("MEDIUM", "Satis personeli lead'i baskasina devredemez/yeniden atayamaz", noEffect(w1));
    // Migration 0034 (2026-10-05): satis personeli YALNIZCA kendisine atanmis leadin
    // satisini kaydedebilir; atanmamis/baskasinin leadine yazamaz, silemez.
    const w2 = await cSalesA.from("sales").insert({ lead_id: leadA2.id, company_id: coA.id, sale_amount: 1 }).select("id");
    record("HIGH", "Satis personeli kendisine atanmamis lead'e satis kaydi olusturamaz", noEffect(w2), w2.error?.message ?? "EKLENDI");
    const w2b = await cSalesA.from("sales").insert({ lead_id: leadA1.id, company_id: coA.id, sale_amount: 1 }).select("id");
    record("INFO", "Satis personeli kendi lead'ine satis kaydi olusturabilir (mesru islev, 0034)", !noEffect(w2b), w2b.error?.message ?? "");
    if (w2b.data?.[0]) {
      const w2c = await cSalesA.from("sales").delete().eq("id", w2b.data[0].id).select("id");
      record("MEDIUM", "Satis personeli satis kaydini silemez", noEffect(w2c));
      await admin.from("sales").delete().eq("id", w2b.data[0].id);
    }
    const w3 = await cSalesA.from("leads").delete().eq("id", leadA1.id).select("id");
    record("MEDIUM", "Satis personeli lead silemez", noEffect(w3));
    const w4 = await cSalesA.from("companies").update({ name: "HACK" }).eq("id", coA.id).select("id");
    record("HIGH", "Satis personeli firma bilgisini degistiremez", noEffect(w4));
    const w5 = await cSalesA.from("integrations").select("id");
    record("LOW", "Satis personeli entegrasyon kayitlarini goremez", noEffect(w5));
  }

  // ---------------------------------- 6b) Profilsiz ("yarim") hesap: kayit acik kalsa bile etkisiz
  {
    const email = `${tag}_orphan@example.com`;
    const { data } = await admin.auth.admin.createUser({ email, password: strongPassword(), email_confirm: true });
    if (data?.user) {
      cleanupUsers.push(data.user.id);
      const cOrphan = await clientFor(email);
      const reads = await Promise.all(["leads", "companies", "profiles", "sales", "activities", "product_categories"].map((t) => cOrphan.from(t).select("id").limit(5)));
      const w = await cOrphan.from("leads").insert({ company_id: coA.id, first_name: "orphan", phone: "1" }).select("id");
      record("CRITICAL", "Profilsiz (yarim) hesap HICBIR veriyi okuyamaz/yazamaz", reads.every(noEffect) && noEffect(w), `okunan=${reads.map((r) => r.data?.length ?? 0).join(",")}`);
    }
  }

  // ------------------------------------------ 7) Pasif kullanici / pasif firma
  {
    // Oturum (JWT) ONCEDEN alinmis; sonra hesap pasiflestiriliyor - gercek senaryo:
    // ise son verilen calisan token'i hala elinde tutuyor.
    await admin.from("profiles").update({ is_active: false }).eq("id", salesA.id);
    const r = await cSalesA.from("leads").select("id");
    const w = await cSalesA.from("leads").insert({ company_id: coA.id, first_name: "pasif", phone: "9", assigned_salesperson: salesA.id }).select("id");
    record("CRITICAL", "PASIF kullanici veritabanina erisemez (okuma)", noEffect(r), `${r.data?.length ?? 0} satir goruyor`);
    record("CRITICAL", "PASIF kullanici veritabanina yazamaz", noEffect(w));
    await admin.from("profiles").update({ is_active: true }).eq("id", salesA.id);

    await admin.from("companies").update({ is_active: false }).eq("id", coA.id);
    const r2 = await cOwnerA.from("leads").select("id");
    record("HIGH", "PASIF firmanin kullanicilari veriye erisemez", noEffect(r2), `${r2.data?.length ?? 0} satir goruyor`);
    await admin.from("companies").update({ is_active: true }).eq("id", coA.id);

    // Geri acilinca mesru erisim donmeli (asiri-kilitleme olmasin)
    const r3 = await cOwnerA.from("leads").select("id");
    record("INFO", "Aktiflestirilince erisim geri gelir (mesru islev bozulmadi)", !noEffect(r3), `${r3.data?.length ?? 0} satir`);
  }

  // ---------------------------------------------- 8) Denetim kaydi (varsa)
  {
    const r = await cSalesA.from("audit_log").select("id").limit(1);
    if (!(r.error && /relation|schema cache|Could not find/i.test(r.error.message))) {
      record("MEDIUM", "Denetim kaydi (audit_log) satis/owner tarafindan OKUNAMAZ", noEffect(r));
      const w = await cOwnerA.from("audit_log").insert({ action: "x", table_name: "x" }).select("id");
      record("HIGH", "Denetim kaydina kullanici YAZAMAZ / SILEMEZ", noEffect(w));
    }
  }
}

async function cleanup() {
  const tables = ["leads", "activities", "followups", "sales", "discovery_visits", "salespeople", "ai_reports"];
  for (const co of cleanupCompanies) {
    for (const t of tables) {
      await admin.from(t).update({ created_by: null }).eq("company_id", co).then(() => {}, () => {});
    }
    await admin.from("leads").update({ updated_by: null }).eq("company_id", co).then(() => {}, () => {});
  }
  for (const id of cleanupUsers) await admin.auth.admin.deleteUser(id).catch(() => {});
  for (const co of cleanupCompanies) await admin.from("companies").delete().eq("id", co);
  const { data: left } = await admin.from("companies").select("id").like("name", `${tag}%`);
  const { data: leftU } = await admin.from("profiles").select("id").like("email", `${tag}%`);
  return (left?.length ?? 0) + (leftU?.length ?? 0);
}

let crashed = null;
try {
  await main();
} catch (e) {
  crashed = e;
} finally {
  const leftovers = await cleanup();
  const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
  results.sort((a, b) => order[a.severity] - order[b.severity]);
  console.log("\nGUVENLIK REGRESYON TESTI\n");
  for (const r of results) {
    console.log(`${r.blocked ? "PASS" : "FAIL"}  [${r.severity.padEnd(8)}] ${r.title}${r.detail && !r.blocked ? "  ->  " + r.detail : ""}`);
  }
  const fails = results.filter((r) => !r.blocked);
  console.log(`\n${results.length - fails.length}/${results.length} basarili, ${fails.length} basarisiz. Temizlik: ${leftovers === 0 ? "tamam (gecici kayit kalmadi)" : "UYARI: " + leftovers + " gecici kayit kaldi"}`);
  if (crashed) console.error("\nTest calisirken hata:", crashed.message);
  process.exit(crashed || fails.length ? 1 : 0);
}
