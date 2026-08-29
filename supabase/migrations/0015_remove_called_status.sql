-- ============================================================================
-- 0015_remove_called_status.sql
-- "Arandi" artik ayri bir pipeline durumu degil (spec: "aradığımda arandı
-- diyorum ama kayıp olduğunda da arandı demem lazım, o kısım oturmuyor -
-- arandıyı durum listesinden kaldıralım, durumu değişen her müşteriye aynı
-- arandı rozetini basalım"). Bunun yerine leads.last_contact_at doluysa
-- (yani en az bir kez gercek durum degisikligi/temas olmus) uygulama
-- tarafinda "Arandı" rozeti otomatik gosteriliyor - ayri bir kolon gerekmedi.
--
-- Mevcut status='called' satirlari 'new'a tasinir - bu leadler zaten
-- last_contact_at doldugu icin "Arandı" rozetini otomatik alacaklar, sadece
-- pipeline asamasi olarak "Lead" gorunecekler (aktif/erken asama).
-- ============================================================================

update public.leads set status = 'new' where status = 'called';

alter table public.leads drop constraint if exists leads_status_check;

alter table public.leads add constraint leads_status_check check (
  status in ('new', 'discovery_offer', 'won', 'followup', 'lost')
);
