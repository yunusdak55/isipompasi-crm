-- ============================================================================
-- 0004_lead_form_v2.sql
-- Lead formu sadelestirme (spec: "Lead olusturma/duzenleme formunu sadelestir")
--
-- Degisiklikler:
--   1) building_status: 'under_construction' ve 'other' eklendi.
--   2) heating_type: serbest metinden sabit secenek kumesine geciyor.
--   3) purchase_timeline: serbest metinden sabit secenek kumesine geciyor.
--   4) leads.offered_amount (yeni): on teklif VEYA kesif sonrasi gercek teklif
--      tutari - V1'de tek alan yeterli (spec: "ileride ayri alanlar gerekirse
--      ayrica eklenecek").
--
-- email / estimated_budget / source / source_campaign KOLONLARI SILINMEDI -
-- sadece UI formundan kaldirildi, ileride kampanya/ROI analizi icin saklaniyor.
--
-- Mevcut satirlarda yeni constraint'lerle CELISEN serbest metin degerleri
-- (orn. purchase_timeline='35') olabilecegi icin constraint eklenmeden once
-- bu tur degerler NULL'a cekilir (veri kaybi sadece o anlamsiz serbest metin
-- icin - lead'in kendisi SILINMEZ).
-- ============================================================================

update public.leads
set purchase_timeline = null
where purchase_timeline is not null
  and purchase_timeline not in ('immediate', '0_1_month', '1_3_month', '3_6_month', '6_plus_month', 'undecided');

update public.leads
set heating_type = null
where heating_type is not null
  and heating_type not in ('combi_gas', 'solid_fuel', 'electric', 'air_conditioner', 'central', 'none', 'other');

alter table public.leads drop constraint if exists leads_building_status_check;
alter table public.leads add constraint leads_building_status_check check (
  building_status in ('new_building', 'existing_building', 'under_construction', 'other')
);

alter table public.leads drop constraint if exists leads_heating_type_check;
alter table public.leads add constraint leads_heating_type_check check (
  heating_type in ('combi_gas', 'solid_fuel', 'electric', 'air_conditioner', 'central', 'none', 'other')
);

alter table public.leads drop constraint if exists leads_purchase_timeline_check;
alter table public.leads add constraint leads_purchase_timeline_check check (
  purchase_timeline in ('immediate', '0_1_month', '1_3_month', '3_6_month', '6_plus_month', 'undecided')
);

alter table public.leads add column if not exists offered_amount numeric(12, 2);

alter table public.leads drop constraint if exists leads_offered_amount_check;
alter table public.leads add constraint leads_offered_amount_check check (offered_amount is null or offered_amount >= 0);

comment on column public.leads.offered_amount is 'On teklif veya kesif sonrasi verilen gercek teklif tutari (V1: tek alan, ileride ayrilabilir).';
comment on column public.leads.email is 'V1 formundan kaldirildi ama kolon korunuyor - gelecekte gerekebilir.';
comment on column public.leads.estimated_budget is 'V1 formundan kaldirildi ama kolon korunuyor - veri kaybini onlemek icin silinmedi.';
comment on column public.leads.source is 'V1 formundan kaldirildi ama kolon korunuyor - Meta kampanya/ROI analizi icin ileride kullanilacak.';
comment on column public.leads.source_campaign is 'V1 formundan kaldirildi ama kolon korunuyor - Meta kampanya/ROI analizi icin ileride kullanilacak.';
