import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
fs.readFileSync(".env.local", "utf8").split("\n").forEach((line) => {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const stamp = Date.now();
const companyName = `Test Firması (Deneme ${stamp})`;
const email = `test-owner-${stamp}@example.com`;

async function main() {
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({ name: companyName, city: "Test Şehri" })
    .select("id")
    .single();
  if (companyError) throw new Error("company: " + companyError.message);
  const companyId = company.id;
  console.log("company_id:", companyId);

  const { data: categories, error: catError } = await supabase
    .from("product_categories")
    .insert([
      { company_id: companyId, label: "Isı Pompası", sort_order: 0 },
      { company_id: companyId, label: "Klima", sort_order: 1 },
      { company_id: companyId, label: "VRF/VRV Sistemi", sort_order: 2 },
      { company_id: companyId, label: "Diğer", sort_order: 3 },
    ])
    .select("id, label");
  if (catError) throw new Error("categories: " + catError.message);

  const { data: userRes, error: userError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: "Test Sahibi", role: "owner", company_id: companyId },
  });
  if (userError) throw new Error("user: " + userError.message);
  console.log("owner_user_id:", userRes.user.id);

  const { data: linkRes, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: "http://localhost:3000/auth/callback" },
  });
  if (linkError) throw new Error("link: " + linkError.message);
  console.log("MAGIC_LINK:", linkRes.properties.action_link);

  // Ayrica bir "sales" kullanicisi da olsun (assigned_salesperson testleri icin).
  const salesEmail = `test-sales-${stamp}@example.com`;
  const { data: salesUserRes, error: salesUserError } = await supabase.auth.admin.createUser({
    email: salesEmail,
    email_confirm: true,
    user_metadata: { full_name: "Test Satışçı", role: "sales", company_id: companyId },
  });
  if (salesUserError) throw new Error("salesUser: " + salesUserError.message);
  const salesUserId = salesUserRes.user.id;
  console.log("sales_user_id:", salesUserId);

  // salespeople roster (contacted_by dropdown icin) - bkz. 0016 migration.
  const { data: salespeople, error: spError } = await supabase
    .from("salespeople")
    .insert([
      { company_id: companyId, full_name: "Test Satışçı", is_owner: false },
      { company_id: companyId, full_name: "Test Sahibi", is_owner: true },
    ])
    .select("id, full_name");
  if (spError) console.error("salespeople warn:", spError.message);

  const heatPumpCat = categories.find((c) => c.label === "Isı Pompası").id;
  const acCat = categories.find((c) => c.label === "Klima").id;
  const vrfCat = categories.find((c) => c.label === "VRF/VRV Sistemi").id;
  const catPool = [heatPumpCat, acCat, vrfCat, null];

  const now = Date.now();
  const hours = (h) => new Date(now - h * 3600 * 1000).toISOString();
  const daysFromNow = (d) => {
    const dt = new Date();
    dt.setHours(10, 0, 0, 0);
    dt.setDate(dt.getDate() + d);
    return dt.toISOString();
  };
  const cities = ["İstanbul", "Ankara", "Bursa", "Sakarya", "Antalya"];
  const firstNames = ["Ahmet", "Mehmet", "Ayşe", "Fatma", "Ali", "Zeynep", "Mustafa", "Elif", "Hüseyin", "Emine"];
  const lastNames = ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Aydın", "Arslan"];

  const leads = [];

  // 1) Grup A (25): hic cevap verilmemis, 24 saatten eski -> Kural A ile GECIKMIS olmali.
  for (let i = 0; i < 25; i++) {
    leads.push({
      company_id: companyId,
      first_name: firstNames[i % firstNames.length],
      last_name: lastNames[i % lastNames.length],
      phone: `0555000${String(1000 + i)}`,
      city: cities[i % cities.length],
      product_category_id: catPool[i % catPool.length],
      status: "new",
      last_contact_at: null,
      created_at: hours(30 + i),
      notes: i % 3 === 0 ? "WhatsApp: Isı pompası fiyat sordu." : null,
    });
  }

  // 2) Grup B (10): hic cevap verilmemis ama 24 saatten YENI -> GECIKMIS OLMAMALI.
  for (let i = 0; i < 10; i++) {
    leads.push({
      company_id: companyId,
      first_name: firstNames[i % firstNames.length],
      last_name: null, // agent WhatsApp adi bulamadi senaryosu
      phone: `0555001${String(1000 + i)}`,
      city: cities[i % cities.length],
      product_category_id: catPool[i % catPool.length],
      status: "new",
      last_contact_at: null,
      created_at: hours(2 + i),
    });
  }

  // 3) Grup C (15): temas kurulmus (last_contact_at dolu), takip tarihi YOK -> hicbir zaman gecikmis sayilmamali (yeni kural).
  for (let i = 0; i < 15; i++) {
    leads.push({
      company_id: companyId,
      first_name: firstNames[i % firstNames.length],
      last_name: lastNames[i % lastNames.length],
      phone: `0555002${String(1000 + i)}`,
      city: cities[i % cities.length],
      product_category_id: catPool[i % catPool.length],
      status: "discovery_offer",
      last_contact_at: hours(100 + i),
      created_at: hours(200 + i),
    });
  }

  // 4) Grup D (15): takip GUNU GECMIS + o gunden beri hicbir aktivite yok -> Kural B ile GECIKMIS olmali.
  for (let i = 0; i < 15; i++) {
    leads.push({
      company_id: companyId,
      first_name: firstNames[i % firstNames.length],
      last_name: lastNames[i % lastNames.length],
      phone: `0555003${String(1000 + i)}`,
      city: cities[i % cities.length],
      product_category_id: catPool[i % catPool.length],
      status: "followup",
      last_contact_at: hours(72 + i),
      next_followup_at: daysFromNow(-(2 + (i % 3))),
      next_followup_note: "Fiyat düşünüyor, geri aranacak.",
      created_at: hours(150 + i),
    });
  }

  // 5) Grup E (10): takip BUGUN -> "Bugün Ara" nabiz rozeti, GECIKMIS OLMAMALI.
  for (let i = 0; i < 10; i++) {
    leads.push({
      company_id: companyId,
      first_name: firstNames[i % firstNames.length],
      last_name: lastNames[i % lastNames.length],
      phone: `0555004${String(1000 + i)}`,
      city: cities[i % cities.length],
      product_category_id: catPool[i % catPool.length],
      status: "followup",
      last_contact_at: hours(20 + i),
      next_followup_at: daysFromNow(0),
      next_followup_note: "Bugün tekrar aranacak.",
      created_at: hours(60 + i),
    });
  }

  // 6) Grup F (10): takip ILERIDE -> GECIKMIS OLMAMALI.
  for (let i = 0; i < 10; i++) {
    leads.push({
      company_id: companyId,
      first_name: firstNames[i % firstNames.length],
      last_name: lastNames[i % lastNames.length],
      phone: `0555005${String(1000 + i)}`,
      city: cities[i % cities.length],
      product_category_id: catPool[i % catPool.length],
      status: "followup",
      last_contact_at: hours(10 + i),
      next_followup_at: daysFromNow(3 + i),
      next_followup_note: "İleri tarihli takip.",
      created_at: hours(40 + i),
    });
  }

  // 7) Grup G (10): Kayıp.
  for (let i = 0; i < 10; i++) {
    leads.push({
      company_id: companyId,
      first_name: firstNames[i % firstNames.length],
      last_name: lastNames[i % lastNames.length],
      phone: `0555006${String(1000 + i)}`,
      city: cities[i % cities.length],
      product_category_id: catPool[i % catPool.length],
      status: "lost",
      last_contact_at: hours(80 + i),
      created_at: hours(300 + i),
    });
  }

  // 8) Grup H (5): Satis (won) - asagida ayrica sales tablosuna kayit eklenecek.
  for (let i = 0; i < 5; i++) {
    leads.push({
      company_id: companyId,
      first_name: firstNames[i % firstNames.length],
      last_name: lastNames[i % lastNames.length],
      phone: `0555007${String(1000 + i)}`,
      city: cities[i % cities.length],
      product_category_id: catPool[i % catPool.length],
      status: "won",
      last_contact_at: hours(50 + i),
      created_at: hours(400 + i),
    });
  }

  // toplam: 25+10+15+15+10+10+10+5 = 100
  const { data: insertedLeads, error: leadsError } = await supabase.from("leads").insert(leads).select("id, status, company_id");
  if (leadsError) throw new Error("leads: " + leadsError.message);
  console.log("inserted leads:", insertedLeads.length);

  // Lost reason gerekli (constraint) - kayip leadlere lost_reason_id ata.
  const { data: lostReasons } = await supabase.from("lost_reasons").select("id").limit(1);
  const lostReasonId = lostReasons?.[0]?.id;
  const lostLeadIds = insertedLeads.filter((l) => l.status === "lost").map((l) => l.id);
  if (lostReasonId && lostLeadIds.length > 0) {
    await supabase.from("leads").update({ lost_reason_id: lostReasonId }).in("id", lostLeadIds);
  }

  // won leadler icin sales kaydi (Satislar sayfasi testi icin).
  const wonLeadIds = insertedLeads.filter((l) => l.status === "won").map((l) => l.id);
  if (wonLeadIds.length > 0) {
    const salesRows = wonLeadIds.map((id, i) => ({
      lead_id: id,
      company_id: companyId,
      sale_amount: 150000 + i * 25000,
      salesperson: salesUserId,
    }));
    const { error: salesError } = await supabase.from("sales").insert(salesRows);
    if (salesError) console.error("sales warn:", salesError.message);
  }

  // Grup D (gecikmis-B) leadlerinden bir kismina, takip gunu GECMEDEN once
  // atilmis eski bir activity ekleyelim (Kural B'nin "o gunden SONRA hicbir
  // aktivite yok" kismini gercekci test etsin - eski aktivite gecikmisligi
  // ONLEMEMELI).
  const groupDIds = insertedLeads.filter((l) => l.status === "followup").slice(0, 5).map((l) => l.id);
  for (const id of groupDIds) {
    await supabase.from("activities").insert({
      lead_id: id,
      company_id: companyId,
      type: "note",
      description: "Eski not (takip gününden önce).",
      created_at: hours(200),
    });
  }

  // Bir kac lead icin kesif ziyareti kaydi (Kesifler sayfasi testi).
  const discoveryLeadIds = insertedLeads.slice(0, 6).map((l) => l.id);
  const visitRows = discoveryLeadIds.map((id, i) => ({
    lead_id: id,
    company_id: companyId,
    visit_date: new Date(now - i * 86400000).toISOString().slice(0, 10),
    location: cities[i % cities.length] + " / Merkez",
    outcome_note: i % 2 === 0 ? "Villa incelendi, teklif hazırlanacak." : "Müşteri evde değildi, tekrar planlanacak.",
  }));
  const { error: visitsError } = await supabase.from("discovery_visits").insert(visitRows);
  if (visitsError) console.error("discovery_visits warn:", visitsError.message);

  console.log("\n=== ÖZET ===");
  console.log("company_id:", companyId);
  console.log("owner email:", email);
  console.log("MAGIC LINK (bu linke giderek owner olarak giriş yapılır):");
  console.log(linkRes.properties.action_link);
}

main().catch((err) => {
  console.error("SEED FAILED:", err.message);
  process.exit(1);
});
