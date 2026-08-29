-- ============================================================================
-- 0016_salespeople_roster.sql
-- Firma sahipleri artik giris hesabi (email/sifre) OLUSTURAMAZ (spec: "Firma
-- sahipleri herhangi bir hesap oluşturma yetkisine SAHİP OLMASIN"). Bunun
-- yerine sadece ISIM bazli, giris yapamayan hafif bir "satis personeli"
-- kaydi tanimlayabilirler - tek amaci bir lead'de "kiminle görüşüldü"
-- bilgisini tutmak (spec: "yalnızca bir satış personeli ismi belirlesin ve
-- o açıldığında leadler ayarı kısmından leadle görüşen kişiyi seçebilelim").
--
-- ONEMLI - BILEREK AYRI TUTULDU: public.leads.assigned_salesperson (ve
-- public.sales.salesperson) kolonlarina HIC DOKUNULMUYOR. O kolonlar,
-- /admin panelinden AJANSIN (firma sahibi degil) bir musteri firmasina
-- actigi GERCEK "sales" rolu giris hesaplarina baglidir ve RLS bu sayede o
-- kisiyi sadece kendine atanan leadlerle sinirlar (bkz. 0002_rls_policies.sql,
-- "assigned_salesperson = auth.uid()"). Bu canli/tasarlanmis bir ozellik -
-- FK'sini bu yeni isim-bazli tabloya cevirmek o RLS izolasyonunu kalici
-- olarak kirar. Onun yerine YENI ve BAGIMSIZ bir "contacted_by" kolonu
-- ekleniyor - iki alan asla cakismaz, biri "gercek hesap/erisim", digeri
-- sadece "bilgi amacli isim etiketi".
-- ============================================================================

create table if not exists public.salespeople (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

comment on table public.salespeople is 'Giris hesabi OLMAYAN, sadece isim bazli satis personeli kaydi - firma sahibinin "leadle görüşen kişi" bilgisini tutmasi icin (spec: firma sahibi hesap olusturamaz, sadece isim tanimlar).';

create index if not exists idx_salespeople_company on public.salespeople (company_id);

alter table public.salespeople enable row level security;

drop policy if exists "salespeople_select" on public.salespeople;
create policy "salespeople_select" on public.salespeople
for select using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() in ('owner', 'sales') and company_id = public.current_user_company_id())
);

drop policy if exists "salespeople_write" on public.salespeople;
create policy "salespeople_write" on public.salespeople
for all using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
)
with check (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
);

-- Lead'de "kiminle görüşüldü" bilgisi - assigned_salesperson'dan BAGIMSIZ.
alter table public.leads
  add column if not exists contacted_by uuid references public.salespeople(id) on delete set null;

create index if not exists idx_leads_contacted_by on public.leads (contacted_by);
