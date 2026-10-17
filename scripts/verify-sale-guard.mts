/**
 * DOGRULAMA ARACI - satis tutarliligi (2026-10-17).
 *   1) Satisi olan lead Kanban'dan (updateLeadStatusAction'in yaptigi gibi) baska
 *      asamaya ALINAMAZ -> uygulama katmani mesaj verir. Burada sunucu action'i
 *      dogrudan cagrilamadigi icin AYNI kontrolun dayandigi veri okunur ve
 *      cancelSaleAction'in izledigi yol RLS'li owner oturumuyla birebir denenir:
 *      satis silinir, lead onceki asamaya doner, cizelgeye iki satir yazilir.
 *   2) Satis personeli satisi SILEMEZ (RLS).
 * Olusan kayitlar sonunda silinir; yalnizca izole test projesi.
 *
 *   npx tsx scripts/verify-sale-guard.mts
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.perftest.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const creds = JSON.parse(fs.readFileSync(".perftest-credentials.json", "utf8")) as {
  companyId: string; ownerEmail: string; ownerPassword: string; salesEmails: string[]; salesPassword: string;
};
const PROD_REF = "dhnwcvirgnkpnlrurdap";
if (!env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL.includes(PROD_REF)) { console.error("DURDURULDU: production"); process.exit(2); }
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, opts);
let failures = 0;
const check = (label: string, ok: boolean, detail = "") => { if (!ok) failures++; console.log(`${ok ? "OK  " : "HATA"} ${label}${detail ? ` -> ${detail}` : ""}`); };
async function signedIn(email: string, password: string) {
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, opts);
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`giris ${email}: ${error.message}`);
  return c;
}

let leadId: string | null = null;
const prevStatus = "discovery_offer";
try {
  const owner = await signedIn(creds.ownerEmail, creds.ownerPassword);
  const sales = await signedIn(creds.salesEmails[0], creds.salesPassword);

  const { data: lead } = await service.from("leads").insert({ company_id: creds.companyId, first_name: "ZZ Satis Koruma", phone: "0599" + String(Math.floor(1_000_000 + Math.random() * 9_000_000)), status: prevStatus }).select("id").single();
  leadId = lead!.id;
  // Uygulamanin satis kaydi akisi: satis + durum "Satış" + cizelge satirlari
  await service.from("sales").insert({ lead_id: leadId, company_id: creds.companyId, sale_amount: 99000 });
  await service.from("leads").update({ status: "won" }).eq("id", leadId);
  await service.from("activities").insert([
    { lead_id: leadId, company_id: creds.companyId, type: "system", description: "Satış yapıldı: ₺99.000" },
    { lead_id: leadId, company_id: creds.companyId, type: "status_change", description: "Durum değişti: Keşif/Teklif → Satış", from_status: prevStatus, to_status: "won" },
  ]);

  // 1) Korumanin dayandigi veri: satis var + durum won -> action reddeder (bkz. actions.ts)
  const { data: guard } = await owner.from("sales").select("sale_amount").eq("lead_id", leadId).maybeSingle();
  check("1  koruma verisi: satis kaydi owner oturumunda gorunuyor", Number(guard?.sale_amount) === 99000);

  // 2) satis personeli silemez
  await sales.from("sales").delete().eq("lead_id", leadId);
  const { data: still } = await service.from("sales").select("id").eq("lead_id", leadId).maybeSingle();
  check("2  satis personeli satisi SILEMEZ", !!still);

  // 3) iptal yolu (cancelSaleAction ile ayni adimlar, owner oturumu)
  const { data: lastWon } = await owner.from("activities").select("from_status").eq("lead_id", leadId).eq("type", "status_change").eq("to_status", "won").order("created_at", { ascending: false }).limit(1).maybeSingle();
  check("3a onceki asama cizelgeden bulunur", lastWon?.from_status === prevStatus, String(lastWon?.from_status));
  const del = await owner.from("sales").delete().eq("lead_id", leadId).select("id");
  check("3b firma sahibi satisi siler", (del.data ?? []).length === 1, del.error?.message ?? "");
  const upd = await owner.from("leads").update({ status: prevStatus }).eq("id", leadId).select("status").maybeSingle();
  check("3c lead onceki asamaya doner", upd.data?.status === prevStatus, upd.error?.message ?? "");
  const act = await owner.from("activities").insert([
    { lead_id: leadId, company_id: creds.companyId, type: "system", description: "Satış iptal edildi: ₺99.000" },
    { lead_id: leadId, company_id: creds.companyId, type: "status_change", description: "Durum değişti: Satış → Keşif/Teklif", from_status: "won", to_status: prevStatus },
  ]);
  check("3d cizelge satirlari yazilir", !act.error, act.error?.message ?? "");
  const { data: after } = await service.from("leads").select("status, sales(id)").eq("id", leadId).single();
  check("3e sonuc: satis yok, durum eski asama", (after!.sales as unknown[]).length === 0 && after!.status === prevStatus);
} catch (e) {
  failures++;
  console.error("BEKLENMEYEN HATA:", e instanceof Error ? e.message : e);
} finally {
  if (leadId) {
    await service.from("activities").delete().eq("lead_id", leadId);
    await service.from("sales").delete().eq("lead_id", leadId);
    await service.from("leads").delete().eq("id", leadId);
  }
  const { count } = await service.from("leads").select("id", { count: "exact", head: true }).eq("first_name", "ZZ Satis Koruma");
  check("Z  temizlik", count === 0);
}
console.log(failures === 0 ? "\nTUM KONTROLLER GECTI" : `\n${failures} KONTROL BASARISIZ`);
process.exit(failures === 0 ? 0 : 1);
