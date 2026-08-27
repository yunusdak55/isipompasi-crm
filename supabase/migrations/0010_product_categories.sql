-- ============================================================================
-- 0010_product_categories.sql
-- "Urun Ilgisi" artik firma bazinda ozellestirilebilir (kullanici karari:
-- "B sikki" - sadece isi pompasi satan firma ile hem isi pompasi hem klima/VRF
-- satan "iklimlendirme" firmasi ayni sabit 4 secenegi gormemeli, her firma
-- kendi urun kategorilerini Firma Ayarlari'ndan yonetsin).
--
-- ONEMLI: leads.product_interest kolonu SILINMIYOR (spec: "DB kolonu asla
-- silinmez, sadece UI'dan kaldirilir") - eski veri korunur, sadece artik
-- yeni kod tarafindan yazilmiyor. Yeni yazim hedefi product_category_id.
-- ============================================================================

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, label)
);

comment on table public.product_categories is 'Firma bazinda ozellestirilebilir urun/hizmet kategorileri (spec: her musteri kendi urun cizgisini tanimlar).';

alter table public.product_categories enable row level security;

drop policy if exists "product_categories_select" on public.product_categories;
create policy "product_categories_select" on public.product_categories
for select using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() in ('owner', 'sales') and company_id = public.current_user_company_id())
);

drop policy if exists "product_categories_write" on public.product_categories;
create policy "product_categories_write" on public.product_categories
for all using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
)
with check (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and company_id = public.current_user_company_id())
);

-- Mevcut her firmaya varsayilan 4 kategori tohumlanir - eski sabit listeyle
-- ayni, boylece hicbir firma "bos" baslamaz, istedigini duzenler/siler/ekler.
insert into public.product_categories (company_id, label, sort_order)
select c.id, cat.label, cat.sort_order
from public.companies c
cross join (values
  ('Isı Pompası', 0),
  ('Klima', 1),
  ('VRF/VRV Sistemi', 2),
  ('Diğer', 3)
) as cat(label, sort_order)
on conflict (company_id, label) do nothing;

-- Yeni alan: lead artik serbest metin/enum yerine firmanin kendi kategori
-- tablosuna referans veriyor.
alter table public.leads
  add column if not exists product_category_id uuid references public.product_categories(id) on delete set null;

-- Mevcut leadlerin eski product_interest degeri, ayni firmanin yeni tohumlanan
-- kategorilerinden esleseniyle otomatik doldurulur - veri kaybi olmaz, kullanici
-- hicbir seyi yeniden girmez.
update public.leads l
set product_category_id = pc.id
from public.product_categories pc
where l.company_id = pc.company_id
  and l.product_interest is not null
  and pc.label = case l.product_interest
    when 'heat_pump' then 'Isı Pompası'
    when 'air_conditioner' then 'Klima'
    when 'vrf' then 'VRF/VRV Sistemi'
    when 'other' then 'Diğer'
  end;
