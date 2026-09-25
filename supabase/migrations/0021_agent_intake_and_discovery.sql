-- ============================================================================
-- 0021_agent_intake_and_discovery.sql
--
-- Spec (kullanici): "agent leadleri alirken hem numarasi hem de isim
-- kismina kisinin whatsapp'ta gozuken ismi ile kayit yapacak, bu olmazsa
-- bos birakacak" - WhatsApp profilinde görünen ad her zaman garanti degil,
-- agent'in bu alani NULL birakip yine de lead olusturabilmesi icin
-- first_name artik zorunlu degil (telefon numarasi tek zorunlu kimlik alani
-- kalir). Uygulama tarafinda (manuel "Yeni Lead" formu) ad soyad hala
-- zorunlu tutulur - bu sadece agent'in dogrudan Supabase'e yazdigi satirlar
-- icin bir esneklik.
--
-- Ayrica: "Gecikenler" hesabinin artik her lead icin SON GERCEK AKTIVITE
-- zamanina (durum degisikligi VEYA herhangi bir not - spec: "zaman
-- cizelgesindeki herhangi bir not bile durum degisikligi sayilir") ihtiyaci
-- var. Bunu her sayfa yuklemesinde activities tablosuna JOIN/subquery ile
-- hesaplamak yerine (N+1/performans riski), leads.last_activity_at
-- denormalize kolonunu activities INSERT'inde otomatik guncelleyen bir
-- trigger ile tutuyoruz - ayni updated_at deseni (bkz. 0001_init_schema.sql).
--
-- Son olarak: yeni "Keşifler" sayfasi icin (spec: "ay icerisinde yapilan
-- kesifler, gidilen yerler, nasil gecti - kime ne zaman nerede kesife
-- gidildigi bilgisini gorusmeyi yapan kisi girebilsin") discovery_visits
-- tablosu - leads/activities ile AYNI RLS deseni.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) first_name artik NOT NULL degil (agent, WhatsApp gorunen adi bulamazsa
--    bos birakabilir - spec).
-- ----------------------------------------------------------------------------
alter table public.leads alter column first_name drop not null;

-- ----------------------------------------------------------------------------
-- 2) last_activity_at: leads.last_contact_at'ten FARKLI - last_contact_at
--    sadece "gercek temas" (durum degisikligi/gorusme sonucu) anlaminda elle
--    guncellenir (bkz. actions.ts). last_activity_at ise zaman cizelgesine
--    (activities) DUSEN HER SEYI (not dahil) yakalar - Gecikenler kurali
--    tam olarak bunu istiyor.
-- ----------------------------------------------------------------------------
alter table public.leads add column if not exists last_activity_at timestamptz;

update public.leads l
set last_activity_at = (
  select max(a.created_at) from public.activities a where a.lead_id = l.id
)
where last_activity_at is null;

create index if not exists idx_leads_last_activity_at on public.leads (last_activity_at);

create or replace function public.touch_lead_last_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.leads set last_activity_at = new.created_at where id = new.lead_id;
  return new;
end;
$$;

comment on function public.touch_lead_last_activity() is 'AFTER INSERT on activities: leads.last_activity_at''i gunceller (Gecikenler hesabi icin - bkz. spec: "zaman cizelgesindeki herhangi bir not bile durum degisikligi sayilir").';

drop trigger if exists trg_activities_touch_lead on public.activities;
create trigger trg_activities_touch_lead
  after insert on public.activities
  for each row execute function public.touch_lead_last_activity();

-- ----------------------------------------------------------------------------
-- 3) discovery_visits ("Keşifler" - satis menusunde Takipte'nin hemen alti)
-- ----------------------------------------------------------------------------
create table if not exists public.discovery_visits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  visit_date date not null default current_date,
  location text,
  outcome_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);

comment on table public.discovery_visits is 'Kesif ziyaretleri gunlugu: kime, ne zaman, nerede kesife gidildigi ve nasil gectigi (spec: "Keşifler" sayfasi).';

create index if not exists idx_discovery_visits_company_id on public.discovery_visits (company_id);
create index if not exists idx_discovery_visits_lead_id on public.discovery_visits (lead_id);
create index if not exists idx_discovery_visits_visit_date on public.discovery_visits (company_id, visit_date desc);

alter table public.discovery_visits enable row level security;

drop trigger if exists trg_discovery_visits_updated_at on public.discovery_visits;
create trigger trg_discovery_visits_updated_at
  before update on public.discovery_visits
  for each row execute function public.set_updated_at();

-- RLS: activities/followups ile AYNI desen (admin tumu, owner kendi firmasi,
-- sales sadece kendisine atanmis leadlerin kesifleri).
drop policy if exists "discovery_visits_select" on public.discovery_visits;
create policy "discovery_visits_select" on public.discovery_visits
for select using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
  or (
    public.current_user_role() = 'sales'
    and company_id = public.current_user_company_id()
    and lead_id in (select id from public.leads where assigned_salesperson = auth.uid())
  )
);

drop policy if exists "discovery_visits_insert" on public.discovery_visits;
create policy "discovery_visits_insert" on public.discovery_visits
for insert with check (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
  or (
    public.current_user_role() = 'sales'
    and company_id = public.current_user_company_id()
    and lead_id in (select id from public.leads where assigned_salesperson = auth.uid())
  )
);

drop policy if exists "discovery_visits_update" on public.discovery_visits;
create policy "discovery_visits_update" on public.discovery_visits
for update using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
  or (
    public.current_user_role() = 'sales'
    and company_id = public.current_user_company_id()
    and lead_id in (select id from public.leads where assigned_salesperson = auth.uid())
  )
)
with check (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
  or (
    public.current_user_role() = 'sales'
    and company_id = public.current_user_company_id()
    and lead_id in (select id from public.leads where assigned_salesperson = auth.uid())
  )
);

drop policy if exists "discovery_visits_delete" on public.discovery_visits;
create policy "discovery_visits_delete" on public.discovery_visits
for delete using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
);
