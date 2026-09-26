-- ============================================================================
-- 0024_performance_and_profile_lockdown.sql
--
-- (1) GUVENLIK: profiles_update_own politikasi her kullaniciya KENDI profil
--     satirini guncelleme izni veriyordu - role/company_id dahil. Yani giris
--     yapmis herhangi biri (ornegin bir satis personeli) herkese acik
--     anahtarla kendi rolunu 'admin' yapip TUM firmalarin verisine
--     erisebiliyordu (test hesabinda dogrulandi, geri alindi). Ayricalikli
--     kolonlar artik sadece admin (veya service_role/SQL) tarafindan
--     degistirilebilir.
-- (2) PERFORMANS (Supabase advisor bulgulari, hepsi anlamca AYNI):
--     - RLS politikalarindaki auth.uid() / current_user_role() /
--       current_user_company_id() cagrilari SATIR BASINA yeniden
--       hesaplaniyordu; (select ...) ile sorgu basina BIR kez hesaplanir.
--     - Ayni tablo+eylem icin birden fazla permissive politika (her satir
--       hepsine karsi degerlendiriliyordu) birlestirildi / eylemlere bolundu.
--     - Eksik indeksler eklendi.
--     - dashboard_stats(): Dashboard sayaclari tum lead satirlarini cekmek
--       yerine veritabaninda tek satirlik ozet olarak hesaplanir.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) profiles ayricalik yukseltme kapatma
-- ----------------------------------------------------------------------------
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() dolu = gercek bir kullanici oturumu (PostgREST/JWT). service_role
  -- ve dogrudan SQL (migration, admin API) icin auth.uid() null'dir -> serbest.
  if auth.uid() is not null and coalesce(public.current_user_role(), '') <> 'admin' then
    if new.role is distinct from old.role
       or new.company_id is distinct from old.company_id
       or new.is_active is distinct from old.is_active then
      raise exception 'Rol, firma ve aktiflik alanlarini sadece ajans admini degistirebilir.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_privileged on public.profiles;
create trigger trg_profiles_protect_privileged
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

-- ----------------------------------------------------------------------------
-- 2) Birlestirilen / bolunen politikalar (cift permissive politika uyarilari)
--    Ifadeler zaten (select ...) ile sarili yazildi.
-- ----------------------------------------------------------------------------

-- profiles: 4 SELECT politikasi -> 1; admin_write(ALL) + update_own -> eylem bazli.
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_company" on public.profiles;
drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "profiles_admin_write" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select" on public.profiles
for select using (
  id = (select auth.uid())
  or (select public.current_user_role()) = 'admin'
  or (company_id is not null and company_id = (select public.current_user_company_id()))
);

create policy "profiles_insert_admin" on public.profiles
for insert with check ((select public.current_user_role()) = 'admin');

create policy "profiles_update" on public.profiles
for update using (id = (select auth.uid()) or (select public.current_user_role()) = 'admin')
with check (id = (select auth.uid()) or (select public.current_user_role()) = 'admin');

create policy "profiles_delete_admin" on public.profiles
for delete using ((select public.current_user_role()) = 'admin');

-- sales / salespeople / product_categories: "_write" (FOR ALL) SELECT'i de
-- kapsiyordu -> select politikasiyla cakisiyordu. Yazma eylemlerine bolundu
-- (etkin erisim degismez: select politikasi write'in kapsadigi herkesi zaten icerir).
do $$
declare
  t text;
begin
  foreach t in array array['sales', 'salespeople', 'product_categories'] loop
    execute format('drop policy if exists %I on public.%I', t || '_write', t);

    execute format($f$create policy %I on public.%I for insert with check (
      (select public.current_user_role()) = 'admin'
      or ((select public.current_user_role()) = 'owner' and company_id = (select public.current_user_company_id()))
    )$f$, t || '_insert', t);

    execute format($f$create policy %I on public.%I for update using (
      (select public.current_user_role()) = 'admin'
      or ((select public.current_user_role()) = 'owner' and company_id = (select public.current_user_company_id()))
    ) with check (
      (select public.current_user_role()) = 'admin'
      or ((select public.current_user_role()) = 'owner' and company_id = (select public.current_user_company_id()))
    )$f$, t || '_update', t);

    execute format($f$create policy %I on public.%I for delete using (
      (select public.current_user_role()) = 'admin'
      or ((select public.current_user_role()) = 'owner' and company_id = (select public.current_user_company_id()))
    )$f$, t || '_delete', t);
  end loop;
end
$$;

-- ----------------------------------------------------------------------------
-- 3) Kalan TUM public politikalarda auth.uid()/current_user_*() -> (select ...)
--    (idempotent: zaten sarili olanlara dokunmaz).
-- ----------------------------------------------------------------------------
do $$
declare
  pol record;
  pattern constant text := '(?<!SELECT )(auth\.uid\(\)|current_user_role\(\)|current_user_company_id\(\))';
  new_qual text;
  new_check text;
begin
  for pol in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
  loop
    new_qual := case when pol.qual is null then null else regexp_replace(pol.qual, pattern, '(select \1)', 'g') end;
    new_check := case when pol.with_check is null then null else regexp_replace(pol.with_check, pattern, '(select \1)', 'g') end;

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

-- ----------------------------------------------------------------------------
-- 4) Indeksler (advisor: unindexed_foreign_keys + siklikla kullanilan siralama)
-- ----------------------------------------------------------------------------
create index if not exists idx_leads_product_category_id on public.leads (product_category_id);
create index if not exists idx_sales_salesperson on public.sales (salesperson);
create index if not exists idx_activities_lead_created on public.activities (lead_id, created_at desc);
create index if not exists idx_agency_prospects_followup on public.agency_prospects (next_followup_at)
  where status in ('new', 'followup');

-- ----------------------------------------------------------------------------
-- 5) Dashboard sayaclari: tek sorguda, veritabaninda ozet. SECURITY INVOKER =
--    cagiran kullanicinin RLS'i aynen gecerli (baska firmanin verisi sayilmaz).
-- ----------------------------------------------------------------------------
create or replace function public.dashboard_stats()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'total', (select count(*) from public.leads),
    'pipeline_value', (
      select coalesce(sum(offered_amount), 0) from public.leads where status not in ('won', 'lost')
    ),
    'by_status', (
      select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
      from (select status, count(*) as n from public.leads group by status) s
    )
  );
$$;

revoke all on function public.dashboard_stats() from public;
grant execute on function public.dashboard_stats() to authenticated;
