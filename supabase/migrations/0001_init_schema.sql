-- ============================================================================
-- 0001_init_schema.sql
-- Isi Pompasi CRM - Baslangic Semasi (Multi-Tenant)
--
-- Sira onemli: bir tablo, referans verdigi tablodan SONRA olusturulmali.
-- companies -> profiles -> lost_reasons -> leads -> activities/followups/
-- offers/sales -> competitors/integrations/ai_reports
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1) companies  (tenant listesi - her biri bir isi pompasi firmasi)
-- ----------------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  city text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.companies is 'Ajansin hizmet verdigi her isi pompasi firmasi (tenant). Tum diger tablolar buna company_id ile baglanir.';

-- ----------------------------------------------------------------------------
-- 2) profiles  (auth.users uzantisi: rol + hangi firmaya ait oldugu)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  role text not null default 'owner' check (role in ('admin', 'owner', 'sales')),
  full_name text,
  email text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- admin ajans genelinde calisir (company_id = null olabilir),
  -- owner ve sales MUTLAKA bir firmaya bagli olmalidir.
  constraint profiles_company_required_unless_admin
    check (role = 'admin' or company_id is not null)
);

comment on table public.profiles is 'Kullanici profili: rol (admin/owner/sales) ve tenant (company_id) bilgisini tasir. auth.users ile 1-1 iliskilidir.';

-- ----------------------------------------------------------------------------
-- 3) lost_reasons  (standart kayip nedenleri - tum firmalarda ortak liste)
-- ----------------------------------------------------------------------------
create table if not exists public.lost_reasons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label_tr text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

comment on table public.lost_reasons is 'Standart kayip nedenleri listesi (varsayim: tum firmalarda ortak; ileride sirket bazli ozellestirme icin company_id eklenebilir).';

insert into public.lost_reasons (code, label_tr, sort_order) values
  ('price', 'Fiyat', 1),
  ('competitor', 'Rakip', 2),
  ('changed_mind', 'Vazgecti', 3),
  ('timing', 'Zamanlama', 4),
  ('no_budget', 'Butce Yok', 5),
  ('unreachable', 'Ulasilamadi', 6),
  ('project_postponed', 'Proje Ertelendi', 7),
  ('other', 'Baska Neden', 8)
on conflict (code) do nothing;

-- ----------------------------------------------------------------------------
-- 4) leads  (ana varlik)
-- ----------------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,

  -- kisi bilgileri
  first_name text not null,
  last_name text,
  phone text not null,
  email text,

  -- musteri / mulk bilgileri
  city text,
  district text,
  property_type text check (
    property_type in ('villa', 'detached_house', 'apartment', 'workplace', 'factory', 'hotel', 'other')
  ),
  area_m2 numeric(10, 2),
  building_status text check (building_status in ('new_building', 'existing_building')),
  heating_type text,
  underfloor_heating boolean not null default false,
  radiator boolean not null default false,
  estimated_budget numeric(12, 2),
  purchase_timeline text,

  -- pazarlama kaynagi
  source text,
  source_campaign text,

  -- atama
  assigned_salesperson uuid references public.profiles(id) on delete set null,

  -- pipeline durumu
  status text not null default 'new' check (
    status in ('new', 'called', 'discovery', 'offer', 'followup', 'won', 'lost', 'unreachable')
  ),
  priority text not null default 'medium' check (priority in ('hot', 'medium', 'cold')),

  -- kayip detayi
  lost_reason_id uuid references public.lost_reasons(id),
  lost_reason_detail text,

  notes text,

  last_contact_at timestamptz,
  next_followup_at timestamptz,
  next_followup_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid(),
  updated_by uuid references public.profiles(id),

  -- spec 10: status = 'lost' ise kayip nedeni ZORUNLU
  constraint leads_lost_reason_required
    check (status <> 'lost' or lost_reason_id is not null)
);

comment on table public.leads is 'CRM ana varligi: reklamdan / WhatsApp''tan gelen her potansiyel musteri.';

-- ----------------------------------------------------------------------------
-- 5) activities  (lead zaman cizelgesi: not, arama, durum degisikligi vb.)
-- ----------------------------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  type text not null default 'note' check (type in ('note', 'status_change', 'call', 'meeting', 'system')),
  description text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);

comment on table public.activities is 'Lead detay sayfasindaki zaman cizelgesi + satis personelinin ekledigi notlar.';

-- ----------------------------------------------------------------------------
-- 6) followups  (takip gecmisi / plani)
-- ----------------------------------------------------------------------------
create table if not exists public.followups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  followup_date timestamptz not null,
  note text,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);

comment on table public.followups is 'Takip tarihi + notu gecmisi. leads.next_followup_at, buradaki en guncel/aktif kaydin denormalize ozetidir (uygulama katmaninda senkron tutulur).';

-- ----------------------------------------------------------------------------
-- 7) offers  (basit teklif takibi)
-- ----------------------------------------------------------------------------
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  offer_date date not null default current_date,
  amount numeric(12, 2),
  status text not null default 'draft' check (status in ('draft', 'sent', 'followup', 'accepted', 'rejected')),
  followup_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);

comment on table public.offers is 'V1: basit teklif takibi. Muhasebe/faturalandirma bu kapsamda degil.';

-- ----------------------------------------------------------------------------
-- 8) sales  (satis kaydi)
-- ----------------------------------------------------------------------------
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  sale_amount numeric(12, 2) not null,
  sale_date date not null default current_date,
  salesperson uuid references public.profiles(id),
  product_service text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);

comment on table public.sales is 'Kapanan satislar. AI Marketing Intelligence icin reklam <-> satis iliskisinin temelini olusturur.';

-- ----------------------------------------------------------------------------
-- 9) competitors  (rakip firma veri modeli - UI sonraki asama)
-- ----------------------------------------------------------------------------
create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  website text,
  city text,
  notes text,
  tracking_frequency text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.competitors is 'AI Competitor Agent icin veri modeli temeli. V1''de sadece sema; otomatik tarama sonraki asama.';

-- ----------------------------------------------------------------------------
-- 10) integrations  (firma bazli entegrasyon durumu)
-- ----------------------------------------------------------------------------
create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null check (
    provider in ('whatsapp', 'meta_ads', 'telegram', 'google_analytics', 'search_console')
  ),
  status text not null default 'disconnected' check (status in ('disconnected', 'pending', 'connected', 'error')),
  config jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, provider)
);

comment on table public.integrations is 'n8n / WhatsApp / Meta / Telegram / GA / Search Console baglanti durumu. RISK NOTU: config jsonb alanina gercek gizli anahtar/token yazilmamali; ileride bir secrets/vault cozumune tasinmali.';

-- ----------------------------------------------------------------------------
-- 11) ai_reports  (AI analiz ciktilarinin onbellegi / gecmisi)
-- ----------------------------------------------------------------------------
create table if not exists public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  report_type text not null,
  period_start date,
  period_end date,
  content jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

comment on table public.ai_reports is 'AI Assistant / Lost Lead / Marketing Intelligence gibi modullerin urettigi analiz ciktilarinin gecmisi. V1''de dashboard AI ozeti mock data kullanir, bu tablo henuz bagli degildir.';

-- ============================================================================
-- INDEX TANIMLARI (performans - bkz. spec md.24 ve md.29)
-- ============================================================================

create index if not exists idx_profiles_company_id on public.profiles (company_id);

create index if not exists idx_leads_company_id on public.leads (company_id);
create index if not exists idx_leads_phone on public.leads (phone);
create index if not exists idx_leads_status on public.leads (status);
create index if not exists idx_leads_created_at on public.leads (created_at desc);
create index if not exists idx_leads_next_followup_at on public.leads (next_followup_at);
create index if not exists idx_leads_assigned_salesperson on public.leads (assigned_salesperson);
create index if not exists idx_leads_company_status on public.leads (company_id, status);
create index if not exists idx_leads_company_created on public.leads (company_id, created_at desc);

create index if not exists idx_activities_lead_id on public.activities (lead_id);
create index if not exists idx_activities_company_id on public.activities (company_id);

create index if not exists idx_followups_lead_id on public.followups (lead_id);
create index if not exists idx_followups_company_date on public.followups (company_id, followup_date);

create index if not exists idx_offers_lead_id on public.offers (lead_id);
create index if not exists idx_offers_company_id on public.offers (company_id);

create index if not exists idx_sales_lead_id on public.sales (lead_id);
create index if not exists idx_sales_company_date on public.sales (company_id, sale_date desc);

create index if not exists idx_competitors_company_id on public.competitors (company_id);
create index if not exists idx_integrations_company_id on public.integrations (company_id);
create index if not exists idx_ai_reports_company_id on public.ai_reports (company_id);

-- ============================================================================
-- updated_at (ve bazi tablolarda updated_by) OTOMATIK GUNCELLEME
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_updated_at_and_by()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

comment on function public.set_updated_at() is 'BEFORE UPDATE trigger: updated_at alanini otomatik gunceller.';
comment on function public.set_updated_at_and_by() is 'BEFORE UPDATE trigger: updated_at + updated_by (auth.uid()) alanlarini otomatik gunceller.';

drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at_and_by();

drop trigger if exists trg_followups_updated_at on public.followups;
create trigger trg_followups_updated_at
  before update on public.followups
  for each row execute function public.set_updated_at();

drop trigger if exists trg_offers_updated_at on public.offers;
create trigger trg_offers_updated_at
  before update on public.offers
  for each row execute function public.set_updated_at_and_by();

drop trigger if exists trg_competitors_updated_at on public.competitors;
create trigger trg_competitors_updated_at
  before update on public.competitors
  for each row execute function public.set_updated_at_and_by();

drop trigger if exists trg_integrations_updated_at on public.integrations;
create trigger trg_integrations_updated_at
  before update on public.integrations
  for each row execute function public.set_updated_at_and_by();
