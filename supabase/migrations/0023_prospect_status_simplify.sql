-- ============================================================================
-- 0023_prospect_status_simplify.sql
--
-- Ajans admin paneli "Satış Görüşmeleri" sadeleştirmesi (spec: "3 farklı
-- seçenek: takibe alırım, kayıp olarak işaretlerim, satış olarak
-- işaretlerim"): "Görüşüldü" (contacted) durumu kaldirildi - bir aday ya
-- aranacak (new), ya takipte, ya musteri oldu ya da kayip. Mevcut
-- 'contacted' satirlari 'followup'a tasinir (gorusulmus ama sonuclanmamis
-- adaylar zaten fiilen takiptedir).
-- ============================================================================

update public.agency_prospects set status = 'followup' where status = 'contacted';

alter table public.agency_prospects drop constraint if exists agency_prospects_status_check;

alter table public.agency_prospects add constraint agency_prospects_status_check check (
  status in ('new', 'followup', 'won', 'lost')
);

comment on column public.agency_prospects.status is 'new=henuz aranmadi, followup=takipte, won=musteri oldu, lost=kayip.';
