/**
 * DOGRULAMA ARACI - migration 0033 (firma basina telefon tekilligi + agent RPC).
 *
 *   A) Indeks: ayni firmada ayni numara (05.. / +90.. / bosluklu / parantezli)
 *      ikinci kez EKLENEMEZ ve baska bir lead'in numarasi ona CEVRILEMEZ;
 *      baska firmada ayni numara serbest; 10 haneden kisa numara kapsam disi.
 *   B) Yaris: ayni numarayla 10 eszamanli insert -> tam 1 lead.
 *   C) agent_upsert_lead: yoksa ekler, varsa AYNI lead'i gunceller; isim ezilmez,
 *      notlar altina eklenir, her notta bir aktivite satiri; insan alanlarina
 *      (status/priority/takip/atama/son gorusme) DOKUNMAZ; gecersiz numara reddedilir.
 *   D) Yaris: ayni numarayla 10 eszamanli RPC -> tam 1 lead, 10 aktivite.
 *
 * Olusan tum kayitlar sonunda silinir. SADECE .env.perftest.local'deki izole
 * test projesine karsi calisir (production'a karsi calismayi REDDEDER).
 *
 *   npx tsx scripts/verify-lead-phone-unique.mts
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.perftest.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const creds = JSON.parse(fs.readFileSync(".perftest-credentials.json", "utf8")) as { companyId: string };

const PROD_REF = "dhnwcvirgnkpnlrurdap";
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
if (!URL_ || !env.SUPABASE_SECRET_KEY || env.SUPABASE_PROJECT_REF === PROD_REF || URL_.includes(PROD_REF)) {
  console.error("DURDURULDU: test projesi ayarlari eksik ya da PRODUCTION'a isaret ediyor.");
  process.exit(2);
}

const service = createClient(URL_, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "HATA"} ${label}${detail ? ` -> ${detail}` : ""}`);
};

const stamp = Date.now();
const companyA = creds.companyId;
let companyB: string | null = null;
const leadIds = new Set<string>();

/** Rastgele, test firmasinda kullanilmayan 7 hane (0599 XXX XX XX). */
const digits7 = () => String(Math.floor(1_000_000 + Math.random() * 9_000_000));

async function insertLead(companyId: string, phone: string) {
  const { data, error } = await service.from("leads").insert({ company_id: companyId, phone, first_name: "ZZ Deneme" }).select("id").single();
  if (data) leadIds.add(data.id);
  return { id: data?.id ?? null, code: error?.code ?? null };
}

async function upsert(args: Record<string, unknown>) {
  const { data, error } = await service.rpc("agent_upsert_lead", args);
  if (typeof data === "string") leadIds.add(data);
  return { id: (data as string | null) ?? null, code: error?.code ?? null };
}

async function main() {
  const { data: company, error: companyError } = await service
    .from("companies")
    .insert({ name: `ZZ Deneme Firma ${stamp}` })
    .select("id")
    .single();
  if (companyError || !company) throw new Error(`firma olusturulamadi: ${companyError?.message}`);
  companyB = company.id;

  // ---------------------------------------------------------------- A) indeks
  const n1 = digits7();
  const base = `0599${n1}`;
  const first = await insertLead(companyA, base);
  check("A1 yeni numara eklenir", first.id !== null, first.code ?? "");

  for (const [label, variant] of [
    ["ayni yazim", base],
    ["+90 ile", `+90599${n1}`],
    ["bosluklu", `0599 ${n1.slice(0, 3)} ${n1.slice(3, 5)} ${n1.slice(5)}`],
    ["parantez/tire", `(0599) ${n1.slice(0, 3)}-${n1.slice(3)}`],
    ["0'siz", `599${n1}`],
  ] as const) {
    const r = await insertLead(companyA, variant);
    check(`A2 ayni firmada ikinci kayit reddedilir (${label})`, r.id === null && r.code === "23505", `kod=${r.code}`);
  }

  const otherCompany = await insertLead(companyB, base);
  check("A3 baska firmada ayni numara serbest", otherCompany.id !== null, otherCompany.code ?? "");

  const second = await insertLead(companyA, `0599${digits7()}`);
  check("A4 farkli numara eklenir", second.id !== null, second.code ?? "");
  const { error: moveError } = await service.from("leads").update({ phone: `+90 599 ${n1}` }).eq("id", second.id!);
  check("A5 baska lead'in numarasi mevcut numaraya cevrilemez", moveError?.code === "23505", `kod=${moveError?.code ?? "yok"}`);

  const short1 = await insertLead(companyA, "12345");
  const short2 = await insertLead(companyA, "12345");
  check("A6 10 haneden kisa numara kapsam disi", short1.id !== null && short2.id !== null);

  // ------------------------------------------------------------ B) insert yarisi
  const raceBase = `0599${digits7()}`;
  const race = await Promise.all(Array.from({ length: 10 }, () => insertLead(companyA, raceBase)));
  const won = race.filter((r) => r.id !== null).length;
  check("B1 10 eszamanli insert -> tam 1 lead", won === 1 && race.filter((r) => r.code === "23505").length === 9, `basarili=${won}`);

  // ------------------------------------------------------------------ C) RPC
  const n2 = digits7();
  const created = await upsert({ p_company_id: companyA, p_phone: `0599${n2}`, p_first_name: "Ayse", p_city: "Sakarya", p_note: "ilk mesaj" });
  check("C1 RPC yeni lead ekler", created.id !== null, created.code ?? "");

  // Insan alanlari: satis ekibi bunlari degistirmis olsun.
  const humanFields = {
    status: "followup",
    priority: "hot",
    last_contact_at: "2026-10-01T09:00:00+00:00",
    next_followup_at: "2026-10-09T09:00:00+00:00",
    next_followup_note: "aranacak",
  };
  const { error: humanError } = await service.from("leads").update(humanFields).eq("id", created.id!);
  if (humanError) throw new Error(`insan alanlari yazilamadi: ${humanError.code} ${humanError.message}`);

  const updated = await upsert({
    p_company_id: companyA,
    p_phone: `+90 599 ${n2}`,
    p_first_name: "Baska Isim",
    p_district: "Sapanca",
    p_area_m2: 140,
    p_product_interest: "heat_pump",
    p_note: "ikinci mesaj",
  });
  check("C2 farkli yazimla gelen ayni numara AYNI lead'i gunceller", updated.id === created.id, `${updated.id} / ${updated.code ?? ""}`);

  const { data: row } = await service.from("leads").select("*").eq("id", created.id!).single();
  check("C3 var olan isim ezilmez", row?.first_name === "Ayse", String(row?.first_name));
  check("C4 yeni bilgi yazilir, gelmeyen korunur", row?.city === "Sakarya" && row?.district === "Sapanca" && Number(row?.area_m2) === 140 && row?.product_interest === "heat_pump");
  const noteLines = String(row?.notes ?? "").split("\n");
  check(
    "C5 notlar zaman damgasiyla altina eklenir",
    noteLines.length === 2 && /^\[\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}\] ilk mesaj$/.test(noteLines[0]) && noteLines[1].endsWith("] ikinci mesaj"),
    JSON.stringify(noteLines)
  );
  check(
    "C6 insan alanlarina dokunulmaz",
    row?.status === "followup" &&
      row?.priority === "hot" &&
      row?.next_followup_note === "aranacak" &&
      new Date(row?.last_contact_at).getTime() === new Date(humanFields.last_contact_at).getTime() &&
      new Date(row?.next_followup_at).getTime() === new Date(humanFields.next_followup_at).getTime() &&
      row?.assigned_salesperson === null,
    `status=${row?.status} priority=${row?.priority}`
  );
  const { data: acts } = await service.from("activities").select("type, description").eq("lead_id", created.id!).order("created_at");
  check(
    "C7 her not icin bir aktivite satiri",
    acts?.length === 2 && acts.every((a) => a.type === "note") && acts[0].description === "WhatsApp: ilk mesaj",
    JSON.stringify(acts)
  );

  const silent = await upsert({ p_company_id: companyA, p_phone: `0599${n2}` });
  const { count: actCount } = await service.from("activities").select("id", { count: "exact", head: true }).eq("lead_id", created.id!);
  const { data: afterSilent } = await service.from("leads").select("notes").eq("id", created.id!).single();
  check("C8 notsuz cagri not/aktivite eklemez", silent.id === created.id && actCount === 2 && afterSilent?.notes === row?.notes);

  const bad = await upsert({ p_company_id: companyA, p_phone: "abc 123" });
  check("C9 gecersiz numara reddedilir", bad.id === null && bad.code === "22023", `kod=${bad.code}`);

  const elsewhere = await upsert({ p_company_id: companyB, p_phone: `0599${n2}`, p_note: "baska firma" });
  check("C10 baska firmada ayri lead acilir", elsewhere.id !== null && elsewhere.id !== created.id, elsewhere.code ?? "");

  // --------------------------------------------------------------- D) RPC yarisi
  const n3 = digits7();
  const rpcRace = await Promise.all(
    Array.from({ length: 10 }, (_, i) => upsert({ p_company_id: companyA, p_phone: i % 2 ? `0599${n3}` : `+90599${n3}`, p_note: `mesaj ${i}` }))
  );
  const ids = new Set(rpcRace.map((r) => r.id));
  const raceId = rpcRace[0].id;
  const { count: raceActs } = await service.from("activities").select("id", { count: "exact", head: true }).eq("lead_id", raceId ?? "");
  const { data: raceRow } = await service.from("leads").select("notes").eq("id", raceId ?? "").single();
  check(
    "D1 10 eszamanli RPC -> tam 1 lead, 10 not, 10 aktivite",
    ids.size === 1 && raceId !== null && raceActs === 10 && String(raceRow?.notes ?? "").split("\n").length === 10,
    `lead=${ids.size} aktivite=${raceActs} hata=${rpcRace.filter((r) => r.code).map((r) => r.code).join(",") || "yok"}`
  );
}

async function cleanup() {
  const ids = [...leadIds];
  if (ids.length > 0) {
    await service.from("activities").delete().in("lead_id", ids);
    const { error } = await service.from("leads").delete().in("id", ids);
    if (error) console.error(`TEMIZLIK HATASI leads: ${error.message}`);
  }
  if (companyB) {
    await service.from("activities").delete().eq("company_id", companyB);
    await service.from("leads").delete().eq("company_id", companyB);
    await service.from("product_categories").delete().eq("company_id", companyB);
    const { error } = await service.from("companies").delete().eq("id", companyB);
    if (error) console.error(`TEMIZLIK HATASI companies: ${error.message}`);
  }
  const { count: leftLeads } = await service.from("leads").select("id", { count: "exact", head: true }).eq("first_name", "ZZ Deneme");
  const { count: leftCompanies } = await service.from("companies").select("id", { count: "exact", head: true }).like("name", "ZZ Deneme Firma%");
  const { count: total } = await service.from("leads").select("id", { count: "exact", head: true }).eq("company_id", companyA);
  check("Z1 temizlik: deneme kaydi kalmadi", leftLeads === 0 && leftCompanies === 0, `lead=${leftLeads} firma=${leftCompanies}`);
  console.log(`Test firmasinda lead sayisi: ${total}`);
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
