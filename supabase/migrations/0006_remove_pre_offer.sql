-- ============================================================================
-- 0006_remove_pre_offer.sql
-- "On Teklif" (pre_offer) asamasi pipeline'dan tamamen kaldirildi (spec:
-- "Ön Teklif kısmını kanban ve filtreden kaldır" - kullanicida gercek bir
-- karsiligi olmadigi icin ayri bir asama olarak tutulmayacak).
--
-- Mevcut pre_offer durumundaki leadler discovery_offer'a tasinir - "on teklif
-- verilmis" bir lead, kesif/teklif asamasindan daha ileride sayilir, en yakin
-- karsilik budur (geriye, "called"a atmak ilerlemeyi geri almis olurdu).
-- ============================================================================

update public.leads
set status = 'discovery_offer'
where status = 'pre_offer';

alter table public.leads drop constraint if exists leads_status_check;

alter table public.leads add constraint leads_status_check check (
  status in ('new', 'called', 'discovery_offer', 'won', 'followup', 'lost', 'unreachable')
);
