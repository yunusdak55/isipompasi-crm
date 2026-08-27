-- ============================================================================
-- 0013_remove_unused_fields.sql
-- Kullanilmayan alan/tablolarin kaldirilmasi (spec: "gereksizleri temizle").
--
-- 1) leads.estimated_budget: lead formundan cok once kaldirildi, hicbir ekran
--    bu alani okumuyor/yazmiyor (dashboard pipeline degeri artik gercekten
--    kullanilan offered_amount'tan hesaplaniyor - bkz. lib/data/dashboard.ts).
--
-- 2) leads.lost_reason_id / lost_reason_detail + lost_reasons tablosu:
--    kullanici karari ile UI'dan tamamen kaldirilmisti (bkz. migration 0008,
--    "kayip nedenlerini kaldir gerek yok"). Bu oturumda eklenen "Kaybedilen
--    Musteri Analizi" raporu bu alani okuyordu ama hicbir ekran doldurmuyordu
--    (rapor hep bos donuyordu) - rapor kaldirildi, alttaki olu alanlar da
--    simdi temizleniyor.
-- ============================================================================

alter table public.leads drop column if exists estimated_budget;
alter table public.leads drop column if exists lost_reason_id;
alter table public.leads drop column if exists lost_reason_detail;

drop table if exists public.lost_reasons;
