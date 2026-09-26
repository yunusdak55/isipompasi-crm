-- ============================================================================
-- 0027_private_helpers_and_fixes.sql
--
-- (1) GUVENLIK: RLS'nin icinde kullanilan current_user_role()/current_user_company_id()
--     `public` semada oldugu icin /rest/v1/rpc uzerinden dogrudan cagrilabiliyordu
--     (Supabase guvenlik denetimi: authenticated_security_definer_function_executable).
--     PostgREST yalnizca `public`/`graphql_public` semalarini aciga cikarir; bu iki
--     yardimci `private` semaya tasindi (RLS politikalari orada da calisir, RPC ile
--     cagrilamaz). Tum politikalar ve protect_profile_privileged_columns yeni konuma
--     baglandi. Davranis AYNI (pasif kullanici/firma NULL doner - bkz. 0026).
-- (2) HATA: sales.sale_date ve discovery_visits.visit_date varsayilani CURRENT_DATE
--     idi; veritabani UTC calistigi icin Turkiye saatiyle 00:00-03:00 arasi girilen
--     satis/kesif ONCEKI gune yaziliyordu. -> Turkiye takvim gunu.
-- (3) PERFORMANS: created_by/updated_by yabanci anahtarlarinda indeks yoktu; kullanici/
--     firma silerken (deleteCompanyAction) her tablo tam taranirdi.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) private sema + tasinan yardimcilar
-- ----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  left join public.companies c on c.id = p.company_id
  where p.id = auth.uid()
    and p.is_active
    and (p.company_id is null or c.is_active)
$$;

create or replace function private.current_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.company_id
  from public.profiles p
  left join public.companies c on c.id = p.company_id
  where p.id = auth.uid()
    and p.is_active
    and (p.company_id is null or c.is_active)
$$;

revoke all on function private.current_user_role() from public, anon;
revoke all on function private.current_user_company_id() from public, anon;
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.current_user_company_id() to authenticated;

-- ----------------------------------------------------------------------------
-- 2) Tum public politikalari yeni konuma bagla (idempotent: zaten tasinanlara dokunmaz)
-- ----------------------------------------------------------------------------
do $$
declare
  pol record;
  pattern constant text := '(?<!private\.)(public\.)?current_user_(role|company_id)\(\)';
  new_qual text;
  new_check text;
begin
  for pol in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
  loop
    new_qual := case when pol.qual is null then null else regexp_replace(pol.qual, pattern, 'private.current_user_\2()', 'g') end;
    new_check := case when pol.with_check is null then null else regexp_replace(pol.with_check, pattern, 'private.current_user_\2()', 'g') end;

    if new_qual is distinct from pol.qual or new_check is distinct from pol.with_check then
      execute format(
        'alter policy %I on %I.%I%s%s',
        pol.policyname, pol.schemaname, pol.tablename,
        case when new_qual is null then '' else ' using (' || new_qual || ')' end,
        case when new_check is null then '' else ' with check (' || new_check || ')' end
      );
    end if;
  end loop;
end
$$;

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and coalesce(private.current_user_role(), '') <> 'admin' then
    if new.role is distinct from old.role
       or new.company_id is distinct from old.company_id
       or new.is_active is distinct from old.is_active
       or new.email is distinct from old.email then
      raise exception 'Rol, firma, aktiflik ve e-posta alanlarini sadece ajans admini degistirebilir.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_profile_privileged_columns() from public, anon, authenticated;

-- Eski public kopyalari kaldir (bagimlilik kalmissa DROP hata verir = guvenli).
drop function if exists public.current_user_role();
drop function if exists public.current_user_company_id();

-- ----------------------------------------------------------------------------
-- 3) Turkiye takvim gunu varsayilani
-- ----------------------------------------------------------------------------
alter table public.sales alter column sale_date set default (timezone('Europe/Istanbul', now()))::date;
alter table public.discovery_visits alter column visit_date set default (timezone('Europe/Istanbul', now()))::date;

-- ----------------------------------------------------------------------------
-- 4) created_by / updated_by yabanci anahtar indeksleri (silme performansi)
-- ----------------------------------------------------------------------------
create index if not exists idx_activities_created_by on public.activities (created_by);
create index if not exists idx_agency_prospect_activities_created_by on public.agency_prospect_activities (created_by);
create index if not exists idx_agency_prospects_created_by on public.agency_prospects (created_by);
create index if not exists idx_ai_reports_created_by on public.ai_reports (created_by);
create index if not exists idx_discovery_visits_created_by on public.discovery_visits (created_by);
create index if not exists idx_followups_created_by on public.followups (created_by);
create index if not exists idx_leads_created_by on public.leads (created_by);
create index if not exists idx_leads_updated_by on public.leads (updated_by);
create index if not exists idx_sales_created_by on public.sales (created_by);
create index if not exists idx_salespeople_created_by on public.salespeople (created_by);
