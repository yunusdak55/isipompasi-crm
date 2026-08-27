-- ============================================================================
-- 0007_remove_unreachable.sql
-- "Ulasilamadi" (unreachable) durumu pipeline'dan tamamen kaldirildi (spec:
-- "Ön Teklif" ile ayni sekilde - kullanicida ayri bir yan-durum olarak
-- tutulmuyor, "her yerden kaldir" talimatiyla).
--
-- Mevcut unreachable durumundaki leadler followup'a tasinir - "ulasilamadi"
-- konsept olarak "tekrar denenmeli" anlamina gelir, en yakin karsilik budur.
-- ============================================================================

update public.leads
set status = 'followup'
where status = 'unreachable';

alter table public.leads drop constraint if exists leads_status_check;

alter table public.leads add constraint leads_status_check check (
  status in ('new', 'called', 'discovery_offer', 'won', 'followup', 'lost')
);
