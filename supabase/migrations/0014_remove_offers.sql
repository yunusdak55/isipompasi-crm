-- ============================================================================
-- 0014_remove_offers.sql
-- "Teklif Geçmişi" ozelligi tamamen kaldirildi (kullanici karari: "adamin
-- zaten zaman cizelgesi notlari var, oraya yazar, kafasi karismaz").
--
-- leads.offered_amount kolonu KALIYOR - dashboard/satislar/raporlardaki
-- "Açık Pipeline Değeri" hesabi hala buna dayaniyor. Artik ayri bir
-- teklif-gecmisi tablosundan degil, dogrudan lead formundan (Musteri
-- Bilgileri Duzenle) tek bir alan olarak giriliyor.
-- ============================================================================

drop table if exists public.offers;
