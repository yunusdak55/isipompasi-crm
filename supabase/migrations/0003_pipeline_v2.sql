-- ============================================================================
-- 0003_pipeline_v2.sql
-- Satis pipeline guncellemesi (spec: "SATIS PIPELINE" degisikligi)
--
-- Eski durumlar: new, called, discovery, offer, followup, won, lost, unreachable
-- Yeni durumlar: new, called, pre_offer, discovery_offer, won, followup, lost, unreachable
--
-- Esleme:
--   discovery, offer  -> discovery_offer  ("Kesif/Teklif": kesif yapildi + gercek
--                        teklif verildi - eski akista 'offer' zaten 'discovery'
--                        sonrasi geldigi icin en yakin karsilik budur)
--   (yeni)             -> pre_offer       ("On Teklif": kesif yapilmadan verilen
--                        yaklasik fiyat - eskiden karsiligi yoktu, tamamen yeni)
--   new/called/won/followup/lost/unreachable -> degismedi
--
-- activities.from_status / to_status: ileride "Lead -> Arandi -> On Teklif -> ..."
-- gibi donusum/funnel analizleri (AI/Raporlar) icin durum degisikliklerinin
-- yapilandirilmis (metin parse etmeden okunabilir) halde saklanmasi icin eklendi.
-- Gecmis status_change kayitlari icin bu iki alan NULL kalir (description metni
-- o an gecerli olan eski etiketlerle zaten degismeden duruyor).
-- ============================================================================

-- 1) Mevcut discovery/offer satirlarini yeni tek asamaya tasi (constraint'i
--    degistirmeden once, aksi halde eski satirlar yeni constraint'i ihlal eder).
update public.leads
set status = 'discovery_offer'
where status in ('discovery', 'offer');

-- 2) leads.status CHECK constraint'ini yeni deger kumesiyle degistir.
alter table public.leads drop constraint if exists leads_status_check;

alter table public.leads add constraint leads_status_check check (
  status in ('new', 'called', 'pre_offer', 'discovery_offer', 'won', 'followup', 'lost', 'unreachable')
);

-- 3) activities: yapilandirilmis durum gecisi kolonlari (serbest metin degil).
alter table public.activities add column if not exists from_status text;
alter table public.activities add column if not exists to_status text;

comment on column public.activities.from_status is 'status_change tipi aktivitelerde onceki durum (ingilizce anahtar). Diger tiplerde/eski kayitlarda NULL.';
comment on column public.activities.to_status is 'status_change tipi aktivitelerde yeni durum (ingilizce anahtar). Diger tiplerde/eski kayitlarda NULL.';
