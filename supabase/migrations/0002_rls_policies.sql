-- ============================================================================
-- 0002_rls_policies.sql
-- Isi Pompasi CRM - Row Level Security (Tenant Izolasyonu + Rol Bazli Erisim)
--
-- Roller (spec md.22):
--   admin  -> tum firmalari gorur/yonetir (company_id = null olabilir)
--   owner  -> sadece KENDI firmasindaki her seyi gorur
--   sales  -> sadece KENDISINE ATANMIS leadleri gorur
--
-- Onemli: "current_user_role/company_id" fonksiyonlari SECURITY DEFINER olarak
-- tanimlanmistir. Bu KASITLIDIR: profiles tablosunun kendi RLS politikasi
-- profiles tablosuna bakan bir alt sorgu icerseydi sonsuz ozyinelemeye
-- (infinite recursion) girerdi. SECURITY DEFINER, fonksiyonun tablo sahibi
-- olarak calismasini saglar ve bu ozyinelemeyi engeller (Supabase tarafindan
-- resmi olarak onerilen cozum budur).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- YARDIMCI FONKSIYONLAR
-- ----------------------------------------------------------------------------

create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_company_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

comment on function public.current_user_role() is 'Oturum acmis kullanicinin rolu (admin/owner/sales). RLS politikalarinda kullanilir.';
comment on function public.current_user_company_id() is 'Oturum acmis kullanicinin bagli oldugu company_id. Admin icin null olabilir.';

revoke all on function public.current_user_role() from public;
revoke all on function public.current_user_company_id() from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_company_id() to authenticated;

-- ----------------------------------------------------------------------------
-- YENI KULLANICI TRIGGERI: auth.users -> public.profiles
-- ----------------------------------------------------------------------------
-- Admin, yeni kullanici olustururken (Supabase Admin API, service/secret key ile
-- SUNUCU tarafinda) user_metadata icine { full_name, role, company_id } gecebilir.
-- Studio uzerinden elle kullanici eklerken de "User Metadata" alanina ayni JSON
-- yazilarak profil otomatik dogru olusturulabilir (bkz. README).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, company_id)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'role', 'owner'),
    nullif(new.raw_user_meta_data ->> 'company_id', '')::uuid
  );
  return new;
end;
$$;

comment on function public.handle_new_user() is 'auth.users''a yeni satir eklendiginde otomatik profiles kaydi olusturur (raw_user_meta_data''dan role/company_id/full_name okur).';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- RLS ETKINLESTIRME (tum tablolar)
-- ----------------------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.lost_reasons enable row level security;
alter table public.leads enable row level security;
alter table public.activities enable row level security;
alter table public.followups enable row level security;
alter table public.offers enable row level security;
alter table public.sales enable row level security;
alter table public.competitors enable row level security;
alter table public.integrations enable row level security;
alter table public.ai_reports enable row level security;

-- ----------------------------------------------------------------------------
-- companies
-- ----------------------------------------------------------------------------

drop policy if exists "companies_select" on public.companies;
create policy "companies_select" on public.companies
for select using (
  public.current_user_role() = 'admin'
  or id = public.current_user_company_id()
);

drop policy if exists "companies_insert_admin" on public.companies;
create policy "companies_insert_admin" on public.companies
for insert with check (public.current_user_role() = 'admin');

drop policy if exists "companies_update_admin" on public.companies;
create policy "companies_update_admin" on public.companies
for update using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "companies_delete_admin" on public.companies;
create policy "companies_delete_admin" on public.companies
for delete using (public.current_user_role() = 'admin');

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (id = auth.uid());

drop policy if exists "profiles_select_company" on public.profiles;
create policy "profiles_select_company" on public.profiles
for select using (
  company_id is not null
  and company_id = public.current_user_company_id()
);

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
for select using (public.current_user_role() = 'admin');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "profiles_admin_write" on public.profiles;
create policy "profiles_admin_write" on public.profiles
for all using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

-- Not: normal kullanicilar profiles tablosuna INSERT/DELETE yapamaz;
-- kayit yalnizca handle_new_user() trigger fonksiyonu (SECURITY DEFINER) ile olusur.

-- ----------------------------------------------------------------------------
-- lost_reasons  (paylasimli referans veri: herkes okur, sadece admin yazar)
-- ----------------------------------------------------------------------------

drop policy if exists "lost_reasons_select_all" on public.lost_reasons;
create policy "lost_reasons_select_all" on public.lost_reasons
for select using (auth.uid() is not null);

drop policy if exists "lost_reasons_admin_write" on public.lost_reasons;
create policy "lost_reasons_admin_write" on public.lost_reasons
for all using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

-- ----------------------------------------------------------------------------
-- leads
-- ----------------------------------------------------------------------------

drop policy if exists "leads_select" on public.leads;
create policy "leads_select" on public.leads
for select using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
  or (
    public.current_user_role() = 'sales'
    and company_id = public.current_user_company_id()
    and assigned_salesperson = auth.uid()
  )
);

drop policy if exists "leads_insert" on public.leads;
create policy "leads_insert" on public.leads
for insert with check (
  public.current_user_role() = 'admin'
  or (public.current_user_role() in ('owner', 'sales') and company_id = public.current_user_company_id())
);

drop policy if exists "leads_update" on public.leads;
create policy "leads_update" on public.leads
for update using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
  or (
    public.current_user_role() = 'sales'
    and company_id = public.current_user_company_id()
    and assigned_salesperson = auth.uid()
  )
)
with check (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
  or (
    public.current_user_role() = 'sales'
    and company_id = public.current_user_company_id()
    and assigned_salesperson = auth.uid()
  )
);

-- Silme: yalniza admin/owner (sales lead silemez)
drop policy if exists "leads_delete" on public.leads;
create policy "leads_delete" on public.leads
for delete using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
);

-- ----------------------------------------------------------------------------
-- activities  (lead ile ayni erisim kurallarini miras alir)
-- ----------------------------------------------------------------------------

drop policy if exists "activities_select" on public.activities;
create policy "activities_select" on public.activities
for select using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
  or (
    public.current_user_role() = 'sales'
    and company_id = public.current_user_company_id()
    and lead_id in (select id from public.leads where assigned_salesperson = auth.uid())
  )
);

drop policy if exists "activities_insert" on public.activities;
create policy "activities_insert" on public.activities
for insert with check (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
  or (
    public.current_user_role() = 'sales'
    and company_id = public.current_user_company_id()
    and lead_id in (select id from public.leads where assigned_salesperson = auth.uid())
  )
);

-- Aktiviteler append-only kabul edilir: update/delete politikasi yok
-- (sadece admin, "profiles_admin_write" benzeri genel yetkisiyle degil,
-- gerekirse ileride ayrica acilir).

-- ----------------------------------------------------------------------------
-- followups
-- ----------------------------------------------------------------------------

drop policy if exists "followups_select" on public.followups;
create policy "followups_select" on public.followups
for select using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
  or (
    public.current_user_role() = 'sales'
    and company_id = public.current_user_company_id()
    and lead_id in (select id from public.leads where assigned_salesperson = auth.uid())
  )
);

drop policy if exists "followups_insert" on public.followups;
create policy "followups_insert" on public.followups
for insert with check (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
  or (
    public.current_user_role() = 'sales'
    and company_id = public.current_user_company_id()
    and lead_id in (select id from public.leads where assigned_salesperson = auth.uid())
  )
);

drop policy if exists "followups_update" on public.followups;
create policy "followups_update" on public.followups
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

-- ----------------------------------------------------------------------------
-- offers
-- ----------------------------------------------------------------------------

drop policy if exists "offers_select" on public.offers;
create policy "offers_select" on public.offers
for select using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
  or (
    public.current_user_role() = 'sales'
    and company_id = public.current_user_company_id()
    and lead_id in (select id from public.leads where assigned_salesperson = auth.uid())
  )
);

drop policy if exists "offers_write" on public.offers;
create policy "offers_write" on public.offers
for all using (
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

-- ----------------------------------------------------------------------------
-- sales  (sadece owner/admin gorur ve yonetir - ciro hassas veridir)
-- ----------------------------------------------------------------------------

drop policy if exists "sales_select" on public.sales;
create policy "sales_select" on public.sales
for select using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
);

drop policy if exists "sales_write" on public.sales;
create policy "sales_write" on public.sales
for all using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
)
with check (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
);

-- ----------------------------------------------------------------------------
-- competitors / integrations / ai_reports
-- (varsayim: stratejik veriler - sadece owner/admin erisir, sales gormez)
-- ----------------------------------------------------------------------------

drop policy if exists "competitors_all" on public.competitors;
create policy "competitors_all" on public.competitors
for all using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
)
with check (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
);

drop policy if exists "integrations_all" on public.integrations;
create policy "integrations_all" on public.integrations
for all using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
)
with check (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
);

drop policy if exists "ai_reports_select" on public.ai_reports;
create policy "ai_reports_select" on public.ai_reports
for select using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
);

drop policy if exists "ai_reports_write_admin" on public.ai_reports;
create policy "ai_reports_write_admin" on public.ai_reports
for insert with check (public.current_user_role() = 'admin');
