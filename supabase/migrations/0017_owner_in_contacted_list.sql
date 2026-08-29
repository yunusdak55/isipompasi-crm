-- ============================================================================
-- 0017_owner_in_contacted_list.sql
-- "Satış Personeli" (Firma Ayarları) ile "Görüşen Kişi" (lead detayı) iki
-- ayrı isimle aynı seyi yonetiyordu - kullanici bir ismi Ayarlar'a ekledi ama
-- nereye baktigina gore "gorunmuyor" gibi hissetti (spec: "Satış personeli
-- kısmını kaldır ve Görüşen kişi kısmına buraya eklenen her kişi Firma
-- Sahibi dahil olmak üzere eklensin, hepsi bir yerde"). Artik TEK bir liste:
-- "Görüşen Kişi" - ve firma sahibinin kendisi de bu listede OTOMATIK olarak
-- yer alir (is_owner=true), elle eklenmesi gerekmez, silinemez.
-- ============================================================================

alter table public.salespeople
  add column if not exists is_owner boolean not null default false;

comment on column public.salespeople.is_owner is 'true ise bu satir firma sahibinin kendisini temsil eder - lib/data/salespeople.ts::ensureOwnerSalesperson tarafindan otomatik olusturulur/senkronize edilir, kullanici arayuzunden silinemez.';

-- Ayni firmada birden fazla "is_owner" satiri olmamali (ensureOwnerSalesperson
-- zaten bunu SELECT-then-INSERT ile garanti eder, ama DB seviyesinde de
-- kesin bir guvenlik agi).
create unique index if not exists idx_salespeople_one_owner_per_company
  on public.salespeople (company_id)
  where is_owner = true;
