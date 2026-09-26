-- ============================================================================
-- 0026_security_hardening.sql
--
-- Guvenlik denetimi bulgulari (scripts/security-audit.mjs ile canli dogrulandi):
--
--  [KRITIK] handle_new_user(), rol ve firmayi kullanicinin KENDI belirledigi
--           raw_user_meta_data'dan okuyordu. Herkese acik kayit (signup) acikken
--           `signUp({ options: { data: { role: 'admin' } } })` ile yeni hesap
--           dogrudan AJANS ADMIN'i (tum firmalarin verisi) veya baska bir
--           firmanin OWNER'i olabiliyordu. -> rol/firma artik yalnizca
--           raw_app_meta_data'dan (sadece service_role/Admin API yazabilir) gelir.
--           user_metadata ile rol/firma ARTIK HIC KABUL EDILMEZ (geriye uyumluluk
--           yolu da yok: e-posta dogrulama asamasi saldirgan tarafindan
--           gecilebildiginden guvenli bir ayirt edici yok). Uygulama kodu
--           createUser'da `app_metadata: { role, company_id }` gondermelidir.
--  [KRITIK] profiles.is_active / companies.is_active hicbir yerde ZORLANMIYORDU:
--           "pasiflestirilen" calisan ya da askiya alinan firma, elindeki
--           oturumla (veya yeniden giris yaparak) verilere okuma/yazma erisimini
--           surdurebiliyordu. -> current_user_role()/current_user_company_id()
--           pasif kullanici ya da pasif firma icin NULL doner; tum RLS
--           politikalari bunlara dayandigindan erisim aninda kesilir.
--  [YUKSEK] Capraz-firma referans butunlugu: bir firma sahibi, baska firmanin
--           lead_id'siyle kendi company_id'sine aktivite/takip/kesif/satis
--           yazabiliyor; SECURITY DEFINER touch_lead_last_activity tetikleyicisi
--           ile DIGER firmanin lead'ini (last_activity_at) degistirebiliyordu.
--           Ayrica lead'i baska firmanin kullanicisina/kategorisine/personeline
--           baglamak mumkundu. -> BEFORE tetikleyicileri ile ayni-firma zorunlu.
--  [YUKSEK] `anon` (giris yapmamis) rolunun TUM tablolarda TRUNCATE dahil tam
--           yetkisi vardi (yalnizca RLS ile korunuyordu). -> tum yetkiler
--           geri alindi; `authenticated` icin TRUNCATE/REFERENCES/TRIGGER kaldirildi.
--  [ORTA]   Tetikleyici / SECURITY DEFINER fonksiyonlar /rest/v1/rpc uzerinden
--           herkes tarafindan cagrilabiliyordu; set_updated_at* fonksiyonlarinin
--           search_path'i sabit degildi.
--  [DUSUK]  Kullanici kendi profiles.email degerini degistirip baskasi gibi
--           gorunebiliyordu.
--  [YENI]   audit_log: ayricalikli degisikliklerin (rol/firma/aktiflik, firma,
--           entegrasyon, satis) degistirilemez kaydi (sadece admin okur).
--
-- Yeni bir tablo/fonksiyon eklerken: artik VARSAYILAN olarak anon/authenticated'a
-- yetki VERILMEZ (alter default privileges asagida). Gerekli yetkiyi acikca ver.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Profil olusturma: rol/firma YALNIZCA guvenilir kaynaktan (app_metadata)
--
-- Not: GoTrue Admin API `createUser` once satiri INSERT eder, `app_metadata`'yi
-- SONRA UPDATE ile yazar (canli test edildi). Bu yuzden ayni fonksiyon hem
-- INSERT hem de app_metadata UPDATE tetikleyicisine baglidir; profil yoksa ve
-- app_metadata'da rol varsa olusturur, varsa dokunmaz (rol degisikligi sadece
-- admin tarafindan profiles uzerinden yapilir).
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_company_raw text;
  v_company uuid;
  v_uuid_re constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  v_role := new.raw_app_meta_data ->> 'role';
  v_company_raw := new.raw_app_meta_data ->> 'company_id';

  -- Guvenilir rol yok (or. herkese acik kayit) => profil OLUSTURMA => hicbir yetki yok.
  if v_role is null or v_role not in ('admin', 'owner', 'sales') then
    return new;
  end if;

  if exists (select 1 from public.profiles p where p.id = new.id) then
    return new;
  end if;

  if v_company_raw is not null and v_company_raw ~ v_uuid_re then
    v_company := v_company_raw::uuid;
  end if;

  -- profiles_company_required_unless_admin: firmasiz owner/sales olusturulamaz.
  if v_role <> 'admin' and v_company is null then
    return new;
  end if;

  insert into public.profiles (id, email, full_name, role, company_id)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',   -- yalniz goruntu adi; yetki DEGIL
    v_role,
    case when v_role = 'admin' then null else v_company end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_app_meta_set on auth.users;
create trigger on_auth_user_app_meta_set
  after update of raw_app_meta_data on auth.users
  for each row
  when (new.raw_app_meta_data ? 'role')
  execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2) Pasif kullanici / pasif firma: RLS yardimcilari NULL doner
-- ----------------------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  left join public.companies c on c.id = p.company_id
  where p.id = auth.uid()
    and p.is_active
    and (p.company_id is null or c.is_active)
$$;

create or replace function public.current_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.company_id
  from public.profiles p
  left join public.companies c on c.id = p.company_id
  where p.id = auth.uid()
    and p.is_active
    and (p.company_id is null or c.is_active)
$$;

-- ----------------------------------------------------------------------------
-- 3) profiles: e-posta da korumali kolon (sadece auth senkronu / admin degistirir)
-- ----------------------------------------------------------------------------
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() dolu = gercek kullanici oturumu (PostgREST/JWT). service_role,
  -- dogrudan SQL ve Auth sunucusunun kendi senkron tetikleyicisi icin null -> serbest.
  if auth.uid() is not null and coalesce(public.current_user_role(), '') <> 'admin' then
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

-- ----------------------------------------------------------------------------
-- 4) Capraz-firma referans butunlugu
-- ----------------------------------------------------------------------------
-- lead_id + company_id tutarliligi (activities, followups, discovery_visits, sales).
-- SECURITY DEFINER: kontrol, cagiranin RLS gorunurlugunden bagimsiz olmali.
create or replace function public.enforce_lead_company_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.leads l where l.id = new.lead_id and l.company_id = new.company_id
  ) then
    raise exception 'lead_id ve company_id ayni firmaya ait olmali.' using errcode = '23514';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['activities', 'followups', 'discovery_visits', 'sales'] loop
    execute format('drop trigger if exists trg_%s_lead_company on public.%I', t, t);
    execute format(
      'create trigger trg_%s_lead_company before insert or update of lead_id, company_id on public.%I
         for each row execute function public.enforce_lead_company_match()', t, t);
  end loop;
end
$$;

-- leads: atanan kullanici / gorusen personel / urun kategorisi ayni firmadan olmali.
create or replace function public.enforce_lead_refs_same_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_salesperson is not null and not exists (
    select 1 from public.profiles p where p.id = new.assigned_salesperson and p.company_id = new.company_id
  ) then
    raise exception 'Atanan kullanici ayni firmaya ait olmali.' using errcode = '23514';
  end if;
  if new.contacted_by is not null and not exists (
    select 1 from public.salespeople s where s.id = new.contacted_by and s.company_id = new.company_id
  ) then
    raise exception 'Gorusen personel ayni firmaya ait olmali.' using errcode = '23514';
  end if;
  if new.product_category_id is not null and not exists (
    select 1 from public.product_categories c where c.id = new.product_category_id and c.company_id = new.company_id
  ) then
    raise exception 'Urun kategorisi ayni firmaya ait olmali.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_refs_same_company on public.leads;
create trigger trg_leads_refs_same_company
  before insert or update of company_id, assigned_salesperson, contacted_by, product_category_id on public.leads
  for each row execute function public.enforce_lead_refs_same_company();

-- sales.salesperson (profil) ayni firmadan olmali.
create or replace function public.enforce_sale_salesperson_same_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.salesperson is not null and not exists (
    select 1 from public.profiles p where p.id = new.salesperson and p.company_id = new.company_id
  ) then
    raise exception 'Satis personeli ayni firmaya ait olmali.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sales_salesperson_company on public.sales;
create trigger trg_sales_salesperson_company
  before insert or update of company_id, salesperson on public.sales
  for each row execute function public.enforce_sale_salesperson_same_company();

-- ----------------------------------------------------------------------------
-- 5) Denetim kaydi (degistirilemez, sadece admin okur)
-- ----------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid,                -- auth.uid(); service_role/SQL islemlerinde null
  action      text not null,       -- INSERT | UPDATE | DELETE
  table_name  text not null,
  row_id      text,
  company_id  uuid,
  changes     jsonb                -- UPDATE: {kolon: {old, new}} yalniz degisenler; INSERT/DELETE: satirin ozeti
);
create index if not exists idx_audit_log_at on public.audit_log (at desc);
create index if not exists idx_audit_log_table_row on public.audit_log (table_name, row_id);

alter table public.audit_log enable row level security;

drop policy if exists "audit_log_select_admin" on public.audit_log;
create policy "audit_log_select_admin" on public.audit_log
for select using ((select public.current_user_role()) = 'admin');
-- INSERT/UPDATE/DELETE politikasi YOK + yetki verilmez: yalniz asagidaki
-- SECURITY DEFINER tetikleyici yazar.

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_changes jsonb;
  v_row_id text;
  v_company uuid;
  v_sensitive constant text[] := array['config'];   -- ham icerigi loga yazma
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new) - v_sensitive;
    v_changes := v_new;
    v_row_id := v_new ->> 'id';
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old) - v_sensitive;
    v_changes := v_old;
    v_row_id := v_old ->> 'id';
  else
    v_old := to_jsonb(old) - v_sensitive;
    v_new := to_jsonb(new) - v_sensitive;
    select coalesce(jsonb_object_agg(k, jsonb_build_object('old', v_old -> k, 'new', v_new -> k)), '{}'::jsonb)
      into v_changes
      from jsonb_object_keys(v_new) as k
      where (v_old -> k) is distinct from (v_new -> k)
        and k not in ('updated_at', 'updated_by');
    if v_changes = '{}'::jsonb then
      return new; -- yalniz updated_at degisti: gurultu, kaydetme
    end if;
    v_row_id := v_new ->> 'id';
  end if;

  v_company := coalesce(
    nullif(coalesce(v_new, v_old) ->> 'company_id', '')::uuid,
    case when tg_table_name = 'companies' then nullif(coalesce(v_new, v_old) ->> 'id', '')::uuid end
  );

  insert into public.audit_log (actor_id, action, table_name, row_id, company_id, changes)
  values (auth.uid(), tg_op, tg_table_name, v_row_id, v_company, v_changes);

  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  -- Hassas/ayricalikli tablolar: profiller, firmalar, entegrasyonlar, ciro.
  foreach t in array array['profiles', 'companies', 'integrations', 'sales'] loop
    execute format('drop trigger if exists trg_%s_audit on public.%I', t, t);
    execute format(
      'create trigger trg_%s_audit after insert or update or delete on public.%I
         for each row execute function public.audit_row_change()', t, t);
  end loop;
end
$$;

-- ----------------------------------------------------------------------------
-- 6) Fonksiyon sertlestirme: search_path + EXECUTE yetkileri
-- ----------------------------------------------------------------------------
alter function public.set_updated_at() set search_path = public;
alter function public.set_updated_at_and_by() set search_path = public;

-- Tetikleyici fonksiyonlari: hic kimse RPC ile cagiramaz (tetikleyici calisirken
-- EXECUTE kontrolu yapilmaz, yani bu geri alma tetikleyicileri bozmaz).
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_user_updated() from public, anon, authenticated;
revoke all on function public.protect_profile_privileged_columns() from public, anon, authenticated;
revoke all on function public.touch_lead_last_activity() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.set_updated_at_and_by() from public, anon, authenticated;
revoke all on function public.enforce_lead_company_match() from public, anon, authenticated;
revoke all on function public.enforce_lead_refs_same_company() from public, anon, authenticated;
revoke all on function public.enforce_sale_salesperson_same_company() from public, anon, authenticated;
revoke all on function public.audit_row_change() from public, anon, authenticated;

-- RLS'nin icinde cagrilan yardimcilar + panel RPC'leri: yalniz giris yapmis kullanici.
revoke all on function public.current_user_role() from public, anon;
revoke all on function public.current_user_company_id() from public, anon;
revoke all on function public.dashboard_stats() from public, anon;
revoke all on function public.agency_company_stats() from public, anon;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_company_id() to authenticated;
grant execute on function public.dashboard_stats() to authenticated;
grant execute on function public.agency_company_stats() to authenticated;

-- ----------------------------------------------------------------------------
-- 7) Tablo yetkileri: anon'a HICBIR sey; authenticated'dan tehlikeli haklar alinir
-- ----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- audit_log: kullanici yalniz okuyabilir (RLS ile admin), yazma HICBIR rolde yok.
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

-- Gelecekteki nesneler icin guvenli varsayilan: anon/authenticated'a otomatik
-- yetki YOK (yeni tabloda `grant select, insert, update, delete ... to authenticated`
-- ve RLS politikasi acikca yazilmali - unutulursa "permission denied" ile GURULTULU
-- basarisiz olur, sessizce acik kalmaz).
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
-- PostgreSQL yeni fonksiyonlara varsayilan olarak PUBLIC'e EXECUTE verir; bunu da kapat.
alter default privileges for role postgres revoke execute on functions from public;
