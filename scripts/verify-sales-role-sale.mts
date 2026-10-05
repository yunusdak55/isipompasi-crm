/**
 * DOGRULAMA ARACI - migration 0034 (satis personeli de satis girebilir).
 *
 * Gercek bir "sales" rolu oturumuyla (RLS'li istemci) dener:
 *   1) kendisine ATANMIS leade satis kaydi ekleyebilir, gorebilir, duzeltebilir
 *   2) BASKASINA atanmis leade satis ekleyemez / o satisi duzeltemez
 *   3) satis kaydini SILEMEZ (yalnizca owner/admin)
 *   4) baska firma adina satis yazamaz
 *   5) kendi leadinin durumunu "Satış" yapabilir (uygulama satisla birlikte bunu da yazar)
 * Firma sahibi icin eski davranis (ekle / duzelt / sil) bozulmamis olmali.
 *
 * Olusan tum kayitlar sonunda silinir, degistirilen lead eski haline doner. SADECE
 * .env.perftest.local'deki izole test projesine karsi calisir.
 *
 *   npx tsx scripts/verify-sales-role-sale.mts
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
  ownerEmail: string;
  ownerPassword: string;
  salesEmails: string[];
  salesPassword: string;
};

const PROD_REF = "dhnwcvirgnkpnlrurdap";
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
if (!URL_ || !env.SUPABASE_SECRET_KEY || env.SUPABASE_PROJECT_REF === PROD_REF || URL_.includes(PROD_REF)) {
  console.error("DURDURULDU: test projesi ayarlari eksik ya da PRODUCTION'a isaret ediyor.");
  process.exit(2);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(URL_, env.SUPABASE_SECRET_KEY, opts);

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "HATA"} ${label}${detail ? ` -> ${detail}` : ""}`);
};

async function signedIn(email: string, password: string) {
  const c = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, opts);
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`giris ${email}: ${error?.message}`);
  return { client: c, id: data.user.id };
}

const createdSaleIds: string[] = [];
let restoreLead: { id: string; status: string } | null = null;

async function main() {
  const me = await signedIn(creds.salesEmails[0], creds.salesPassword);
  const other = await signedIn(creds.salesEmails[1], creds.salesPassword);

  // Satisi olmayan iki lead: biri bana, digeri baska satis personeline atanmis.
  const pickLead = async (assignee: string) => {
    const { data } = await service
      .from("leads")
      .select("id, status, sales(id)")
      .eq("company_id", creds.companyId)
      .eq("assigned_salesperson", assignee)
      .neq("status", "won")
      .limit(20);
    return (data ?? []).find((l) => (l.sales as unknown[]).length === 0) ?? null;
  };
  const mine = await pickLead(me.id);
  const theirs = await pickLead(other.id);
  if (!mine || !theirs) throw new Error("test icin uygun lead bulunamadi");
  restoreLead = { id: mine.id, status: mine.status };

  // 1) kendi leadim
  const ins = await me.client
    .from("sales")
    .insert({ lead_id: mine.id, company_id: creds.companyId, sale_amount: 12345, salesperson: me.id, notes: "ZZ deneme" })
    .select("id, sale_amount")
    .single();
  if (ins.data) createdSaleIds.push(ins.data.id);
  check("1a satis personeli kendi leadine satis ekler", !!ins.data, ins.error?.message ?? "");

  const seen = await me.client.from("sales").select("id, sale_amount, notes").eq("lead_id", mine.id).maybeSingle();
  check("1b ekledigi satisi gorur", seen.data?.id === ins.data?.id);

  const upd = await me.client.from("sales").update({ sale_amount: 23456, notes: "ZZ deneme 2" }).eq("id", ins.data?.id ?? "").select("sale_amount").maybeSingle();
  check("1c tutari / notu duzeltebilir", Number(upd.data?.sale_amount) === 23456, upd.error?.message ?? "");

  // 5) kendi leadini "Satış" yapabilir
  const won = await me.client.from("leads").update({ status: "won" }).eq("id", mine.id).select("status").maybeSingle();
  check("5  kendi leadinin durumunu Satış yapar", won.data?.status === "won", won.error?.message ?? "");

  // 2) baskasinin leadi
  const foreign = await me.client
    .from("sales")
    .insert({ lead_id: theirs.id, company_id: creds.companyId, sale_amount: 999, salesperson: me.id })
    .select("id")
    .maybeSingle();
  if (foreign.data) createdSaleIds.push(foreign.data.id);
  check("2a baskasina atanmis leade satis EKLEYEMEZ", !foreign.data && foreign.error?.code === "42501", `kod=${foreign.error?.code ?? "yok"}`);

  const theirSale = await service
    .from("sales")
    .insert({ lead_id: theirs.id, company_id: creds.companyId, sale_amount: 500, salesperson: other.id })
    .select("id")
    .single();
  if (theirSale.data) createdSaleIds.push(theirSale.data.id);
  const tamper = await me.client.from("sales").update({ sale_amount: 1 }).eq("id", theirSale.data?.id ?? "").select("id");
  const { data: afterTamper } = await service.from("sales").select("sale_amount").eq("id", theirSale.data?.id ?? "").single();
  check("2b baskasinin satisini DUZELTEMEZ", (tamper.data ?? []).length === 0 && Number(afterTamper?.sale_amount) === 500);

  // 3) silme yok
  await me.client.from("sales").delete().eq("id", ins.data?.id ?? "");
  const { data: stillThere } = await service.from("sales").select("id").eq("id", ins.data?.id ?? "").maybeSingle();
  check("3  satis personeli satis kaydini SILEMEZ", !!stillThere);

  // 4) baska firma
  const { data: otherCompany } = await service.from("companies").insert({ name: `ZZ Deneme Firma ${Date.now()}` }).select("id").single();
  const cross = await me.client
    .from("sales")
    .insert({ lead_id: mine.id, company_id: otherCompany?.id ?? crypto.randomUUID(), sale_amount: 1, salesperson: me.id })
    .select("id")
    .maybeSingle();
  if (cross.data) createdSaleIds.push(cross.data.id);
  check("4  baska firma adina satis yazamaz", !cross.data, `kod=${cross.error?.code ?? "yok"}`);
  if (otherCompany) {
    await service.from("product_categories").delete().eq("company_id", otherCompany.id);
    await service.from("companies").delete().eq("id", otherCompany.id);
  }

  // Firma sahibi: eski davranis
  const owner = await signedIn(creds.ownerEmail, creds.ownerPassword);
  const ownerUpd = await owner.client.from("sales").update({ sale_amount: 600 }).eq("id", theirSale.data?.id ?? "").select("sale_amount").maybeSingle();
  check("6a firma sahibi her satisi duzeltebilir", Number(ownerUpd.data?.sale_amount) === 600, ownerUpd.error?.message ?? "");
  const ownerDel = await owner.client.from("sales").delete().eq("id", theirSale.data?.id ?? "").select("id");
  check("6b firma sahibi satis kaydini silebilir", (ownerDel.data ?? []).length === 1);
}

async function cleanup() {
  if (createdSaleIds.length > 0) await service.from("sales").delete().in("id", createdSaleIds);
  if (restoreLead) await service.from("leads").update({ status: restoreLead.status }).eq("id", restoreLead.id);
  const { count } = await service.from("sales").select("id", { count: "exact", head: true }).in("id", createdSaleIds.length > 0 ? createdSaleIds : [crypto.randomUUID()]);
  check("Z  temizlik: deneme satisi kalmadi", count === 0, `kalan=${count}`);
}

try {
  await main();
} catch (e) {
  failures++;
  console.error("BEKLENMEYEN HATA:", e instanceof Error ? e.message : e);
} finally {
  await cleanup();
}

console.log(failures === 0 ? "\nTUM KONTROLLER GECTI" : `\n${failures} KONTROL BASARISIZ`);
process.exit(failures === 0 ? 0 : 1);
