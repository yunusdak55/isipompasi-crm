import { createClient } from "@/lib/supabase/server";
import { LEAD_STATUS_ORDER } from "@/lib/constants/lead";
import { FOLLOWUP_OVERDUE_HOURS, formatRelativeDays, isLeadOverdue, leadDisplayName } from "@/lib/utils";
import { fetchAllRows } from "@/lib/data/paginate";
import { endOfDayTR, monthStartTR } from "@/lib/time";
import { sortByFollowupUrgency } from "@/lib/followup";
import type { LeadPriority, LeadStatus } from "@/lib/types/domain";

/**
 * ILIKE joker karakterlerini ve PostgREST `.or()` filtre sozdizimini
 * (`,` `(` `)` `"` `\` `:` `*`) bozabilecek karakterleri temizler. Aksi halde arama
 * kutusuna yazilan metin ek filtre kosulu enjekte edebilir. Uzunluk da sinirlidir.
 */
export function sanitizeSearchTerm(term: string) {
  return term.replace(/[,()%_"'\\*:;]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export type LeadListItem = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string;
  city: string | null;
  area_m2: number | null;
  property_type: string | null;
  status: LeadStatus;
  priority: "hot" | "cold";
  next_followup_at: string | null;
  next_followup_note: string | null;
  offered_amount: number | null;
  last_contact_at: string | null;
  last_activity_at: string | null;
  created_at: string;
  assigned_profile: { full_name: string | null } | null;
  contacted_by_person: { full_name: string | null } | null;
};

const LEAD_LIST_COLUMNS =
  "id, first_name, last_name, phone, city, area_m2, property_type, status, priority, next_followup_at, next_followup_note, offered_amount, last_contact_at, last_activity_at, created_at, assigned_profile:profiles!leads_assigned_salesperson_fkey(full_name), contacted_by_person:salespeople!leads_contacted_by_fkey(full_name)";

/**
 * Lead listesini SERVER-SIDE sayfalama + filtre ile getirir (spec md.29:
 * "server-side query" tercih edilmeli). RLS sayesinde donen satirlar zaten
 * oturum acan kullanicinin (admin/owner/sales) gorebilecegi satirlarla sinirli.
 */
export async function getLeads(params: { search?: string; status?: LeadStatus; page?: number; pageSize?: number }) {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("leads")
    .select(LEAD_LIST_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.status) {
    query = query.eq("status", params.status);
  }

  if (params.search) {
    const term = sanitizeSearchTerm(params.search);
    if (term.length > 0) {
      query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,phone.ilike.%${term}%`);
    }
  }

  const { data, count, error } = await query;

  if (error) {
    // Olmayan bir sayfa numarasi (ör. silinen kayitlar sonrasi eski bir baglanti, elle yazilmis
    // ?page=999) PostgREST'te "Requested range not satisfiable" (PGRST103) verir. Bos liste ve
    // "0 lead" gostermek YANILTICI olurdu - ilk sayfaya dus.
    if (error.code === "PGRST103" && page > 1) {
      return getLeads({ ...params, page: 1 });
    }
    console.error("getLeads error:", error.message);
    return { leads: [] as LeadListItem[], count: 0, page, pageSize };
  }

  return { leads: (data ?? []) as unknown as LeadListItem[], count: count ?? 0, page, pageSize };
}

/** Lead detay sayfasi icin tek lead + atanan kisi. */
/** URL'den gelen id gercekten UUID mi? Degilse veritabanina hic gitmeden "yok" sayilir (hata logu + bos sorgu yok). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export async function getLeadById(id: string) {
  if (!isUuid(id)) return null;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("leads")
    .select(
      `*,
      assigned_profile:profiles!leads_assigned_salesperson_fkey(id, full_name),
      contacted_by_person:salespeople!leads_contacted_by_fkey(id, full_name),
      product_category:product_categories(id, label)`
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("getLeadById error:", error.message);
    return null;
  }

  return data;
}

/** Lead zaman cizelgesi (spec md.10). V1'de bos gelebilir; UI bunu ele alir. */
export async function getLeadActivities(leadId: string) {
  if (!isUuid(leadId)) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getLeadActivities error:", error.message);
    return [];
  }

  return data ?? [];
}

/** Bir lead icin kayitli gercek satis (varsa). RLS: sadece owner/admin gorur. */
export async function getSaleForLead(leadId: string) {
  if (!isUuid(leadId)) return null;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sales")
    .select("id, sale_amount, sale_date")
    .eq("lead_id", leadId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getSaleForLead error:", error.message);
    return null;
  }

  return data;
}

export type LeadSelectItem = { id: string; first_name: string | null; last_name: string | null; phone: string };

/** Bir firmada lead atanabilecek kisiler (owner + sales). Atama dropdown'u icin. */
export async function getAssignableProfiles(companyId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .in("role", ["owner", "sales"])
    .order("full_name");

  if (error) {
    console.error("getAssignableProfiles error:", error.message);
    return [];
  }

  return data ?? [];
}

export type BoardLead = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string;
  city: string | null;
  status: LeadStatus;
  priority: LeadPriority;
  offered_amount: number | null;
  last_contact_at: string | null;
  last_activity_at: string | null;
  next_followup_at: string | null;
  created_at: string;
  assigned_profile: { full_name: string | null } | null;
  contacted_by_person: { full_name: string | null } | null;
};

/** Kanban'da her kolon icin sunucudan alinan EN FAZLA kart sayisi (en yeni olusturulandan baslayarak). */
export const BOARD_COLUMN_CAP = 300;

export type BoardData = {
  leads: Record<LeadStatus, BoardLead[]>;
  /** Her kolondaki GERCEK toplam (sunucudaki sayi) - yuklenen kart sayisindan buyuk olabilir. */
  totals: Record<LeadStatus, number>;
};

const BOARD_SELECT =
  "id, first_name, last_name, phone, city, status, priority, offered_amount, last_contact_at, last_activity_at, next_followup_at, created_at, assigned_profile:profiles!leads_assigned_salesperson_fkey(full_name), contacted_by_person:salespeople!leads_contacted_by_fkey(full_name)";

/**
 * Kanban pipeline icin durum bazinda gruplanmis lead listesi. RLS sayesinde
 * kullanicinin (rol farketmeksizin) gorebilecegi leadlerle otomatik sinirli.
 *
 * SINIRLI YUKLEME (guvenlik supabi, 2026-10-05): eskiden TUM leadler cekilip tarayiciya
 * gonderiliyordu (5.000 lead = ~3 MB sayfa, 9 sirali sorgu, binlerce kart). Simdi her
 * kolon icin EN YENI BOARD_COLUMN_CAP kart + o kolonun gercek toplami TEK paralel turda
 * gelir (5 sorgu). Gercek firmalar (yuzlerce lead) bu sinira hic takilmaz; sinir asilirsa
 * kolon altinda "Liste Gorunumu" uyarisi cikar. Hicbir veri silinmez/gizlenmez - sadece
 * ayni anda tarayiciya yuklenen miktar sinirlanir.
 */
export async function getLeadsForBoard(): Promise<BoardData> {
  const supabase = await createClient();

  const results = await Promise.all(
    LEAD_STATUS_ORDER.map((status) =>
      supabase
        .from("leads")
        .select(BOARD_SELECT, { count: "exact" })
        .eq("status", status)
        .order("created_at", { ascending: false })
        .order("id")
        .limit(BOARD_COLUMN_CAP)
    )
  );

  const leads = Object.fromEntries(LEAD_STATUS_ORDER.map((status) => [status, [] as BoardLead[]])) as Record<LeadStatus, BoardLead[]>;
  const totals = Object.fromEntries(LEAD_STATUS_ORDER.map((status) => [status, 0])) as Record<LeadStatus, number>;

  results.forEach((res, i) => {
    const status = LEAD_STATUS_ORDER[i];
    if (res.error) {
      console.error("getLeadsForBoard error:", status, res.error.message);
      return;
    }
    leads[status] = (res.data ?? []) as unknown as BoardLead[];
    totals[status] = res.count ?? leads[status].length;
  });

  return { leads, totals };
}

/**
 * "Takipte" ekrani (spec md.4): takip tarihi olan, henuz kapanmamis leadler.
 * Kapanmis (satis/kayip) leadlerde takip anlamsizdir.
 *
 * SIRALAMA (spec 2026-10-04, "HER YER icin" - bkz. lib/followup.ts
 * sortByFollowupUrgency): once BUGUNKU takipler, sonra gecikmisler (en az
 * geciken en ustte, gun sayisi arttikca asagi), sonra gelecek takipler (en
 * yakin once). Gecmis ile gelecek artik birbirine karismaz.
 */
export async function getLeadsFollowup(): Promise<LeadListItem[]> {
  const supabase = await createClient();

  const { data, error } = await fetchAllRows((from, to) =>
    supabase
      .from("leads")
      .select(LEAD_LIST_COLUMNS)
      .not("next_followup_at", "is", null)
      .not("status", "in", "(won,lost)")
      .order("next_followup_at", { ascending: true })
      .order("id")
      .range(from, to)
  );

  if (error) {
    console.error("getLeadsFollowup error:", error.message);
    return [];
  }

  return sortByFollowupUrgency((data ?? []) as unknown as LeadListItem[], (lead) => lead.next_followup_at as string);
}

export type UndatedFollowupLead = { id: string; first_name: string | null; last_name: string | null; phone: string };

/**
 * "Takip" ASAMASINDA ama takip TARIHI olmayan leadler. Takipte listesi tarihe gore
 * calistigi icin bu kayitlar orada GORUNMEZ (Kanban'da "Takip" sutununa tarihsiz
 * tasinabilir, "Takibi kaldir" da durumu degistirmez) - unutulmasinlar diye ayri
 * uyari olarak gosterilir. Sayi tam (count), liste ilk 12 kayit (en yeni once).
 */
export async function getFollowupStageWithoutDate(): Promise<{ count: number; leads: UndatedFollowupLead[] }> {
  const supabase = await createClient();

  const [countRes, listRes] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "followup").is("next_followup_at", null),
    supabase
      .from("leads")
      .select("id, first_name, last_name, phone")
      .eq("status", "followup")
      .is("next_followup_at", null)
      .order("created_at", { ascending: false })
      .order("id")
      .limit(12),
  ]);

  if (countRes.error || listRes.error) {
    console.error("getFollowupStageWithoutDate error:", (countRes.error ?? listRes.error)?.message);
    return { count: 0, leads: [] };
  }

  return { count: countRes.count ?? 0, leads: (listRes.data ?? []) as UndatedFollowupLead[] };
}

/** Zil hatirlatmasi: lead (firma paneli) ya da aday (ajans admin) - href hedefi kaynaga gore degisir. */
export type DueFollowup = {
  id: string;
  name: string;
  date: string;
  overdue: boolean;
  href: string;
  /** Sunucuda hesaplanan goreli yazi: "Bugün" / "Dün" / "3 gün gecikti" (bkz. formatRelativeDays). */
  label: string;
};

/**
 * Topbar'daki hatirlatma zili icin: tarihi gelmis (bugun dahil) veya gecmis
 * takipler. Hafif bir liste - sadece isim + tarih, tam lead detayi degil.
 * SIRALAMA: bugunku takipler en ustte, ardindan gecikmisler en az geciken
 * once (gun sayisi arttikca asagi) - bkz. getLeadsOverdue'daki ayni prensip.
 */
export async function getDueFollowups(): Promise<DueFollowup[]> {
  const supabase = await createClient();
  const todayEnd = endOfDayTR().toISOString();

  const { data, error } = await supabase
    .from("leads")
    .select("id, first_name, last_name, next_followup_at")
    .not("next_followup_at", "is", null)
    .not("status", "in", "(won,lost)")
    .lte("next_followup_at", todayEnd)
    .order("next_followup_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("getDueFollowups error:", error.message);
    return [];
  }

  const now = new Date();
  return (data ?? []).map((lead) => ({
    id: lead.id,
    href: `/leads/${lead.id}`,
    // Agent WhatsApp adini bulamazsa first_name bos olabilir (bkz. leadDisplayName).
    name: leadDisplayName(lead),
    date: lead.next_followup_at as string,
    overdue: new Date(lead.next_followup_at as string) < now,
    label: formatRelativeDays(lead.next_followup_at) ?? "",
  }));
}

/**
 * "Takvim" ekrani: verilen ay icinde takip/kesif tarihi olan leadler, gun
 * gun gruplanmak uzere ham liste olarak doner (gruplama sayfa tarafinda
 * yapilir). Kapanmis (satis/kayip) leadler haric - onlarin artik bir
 * randevusu olmaz.
 */
export async function getLeadsCalendar(year: number, month: number): Promise<LeadListItem[]> {
  const supabase = await createClient();

  const rangeStart = monthStartTR(year, month).toISOString();
  const rangeEnd = monthStartTR(year, month + 1).toISOString();

  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_LIST_COLUMNS)
    .gte("next_followup_at", rangeStart)
    .lt("next_followup_at", rangeEnd)
    .not("status", "in", "(won,lost)")
    .order("next_followup_at", { ascending: true });

  if (error) {
    console.error("getLeadsCalendar error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as LeadListItem[];
}

/**
 * "Gecikenler" ekrani + Dijital Ajan'in "gecikmis takip" sayisi (spec
 * 2026-10-02): YALNIZCA takibe alinmis leadler, takip tarihinin uzerinden
 * 24 saatten fazla gecmis olanlar. SQL burada kaba on-filtre (takip tarihi
 * esikten eski, kapanmamis); "takip zamanindan bu yana aktivite var mi"
 * istisnasi PostgREST'te kolon-kolon karsilastirilamadigi icin kesin karar
 * isLeadOverdue() ile (lib/utils.ts, TEK yer) JS'te veriliyor - rozetler,
 * kanban ve chatbot ile bu sayfa arasinda ASLA celisme olmaz.
 *
 * SIRALAMA (spec 2026-10-04, "HER YER icin"): GECIKME GUN SAYISINA gore
 * kucukten buyuge - 1 gun gecikmis en ustte, sonra 2, 5, 10... (en yeni
 * gecikme once, takibi kolay olsun). Takip tarihine gore AZALAN siralama
 * (tarih ne kadar yeniyse gecikme o kadar az) tam olarak bunu verir.
 */
export async function getLeadsOverdue(): Promise<LeadListItem[]> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - FOLLOWUP_OVERDUE_HOURS * 60 * 60 * 1000).toISOString();

  // fetchAllRows: 1000 satir ustu sessizce kesilmesin (bkz. data/paginate.ts).
  const { data, error } = await fetchAllRows((from, to) =>
    supabase
      .from("leads")
      .select(LEAD_LIST_COLUMNS)
      .not("status", "in", "(won,lost)")
      .not("next_followup_at", "is", null)
      .lt("next_followup_at", cutoff)
      .order("next_followup_at", { ascending: false })
      .order("id")
      .range(from, to)
  );

  if (error) {
    console.error("getLeadsOverdue error:", error.message);
    return [];
  }

  return ((data ?? []) as unknown as LeadListItem[]).filter((lead) =>
    isLeadOverdue({
      status: lead.status,
      lastContactAt: lead.last_contact_at,
      createdAt: lead.created_at,
      nextFollowupAt: lead.next_followup_at,
      lastActivityAt: lead.last_activity_at,
    })
  );
}
