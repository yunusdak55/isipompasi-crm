-- ============================================================================
-- 0011_fix_updated_by_triggers.sql
-- BUG FIX: 0001_init_schema.sql'de offers/competitors/integrations tablolarina
-- "set_updated_at_and_by()" trigger'i baglanmis, ama bu trigger "new.updated_by
-- = auth.uid()" atamaya calisiyor - oysa bu UC tabloda "updated_by" diye bir
-- KOLON HIC YOK (sadece leads tablosunda var). Sonuc: bu 3 tabloya yapilan
-- HER UPDATE, Postgres hatasi ile sessizce basarisiz oluyordu ("record new
-- has no field updated_by") - INSERT'ler etkilenmiyordu, bu yuzden fark
-- edilmemisti (orn. Entegrasyonlar panelinde bir durumu ilk kez isaretlemek
-- calisiyordu (insert), ama sonradan degistirmek (update) sessizce basarisiz
-- oluyordu).
--
-- Bu 3 tablonun hicbiri UI'da "kim guncelledi" bilgisini goster miyor, o
-- yuzden kolon eklemek yerine (kullanilmayacak veri = gereksiz) trigger'lari
-- basit "set_updated_at()" (sadece updated_at, updated_by yok) fonksiyonuna
-- ceviriyoruz - dogru cozum bu.
-- ============================================================================

drop trigger if exists trg_offers_updated_at on public.offers;
create trigger trg_offers_updated_at
  before update on public.offers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_competitors_updated_at on public.competitors;
create trigger trg_competitors_updated_at
  before update on public.competitors
  for each row execute function public.set_updated_at();

drop trigger if exists trg_integrations_updated_at on public.integrations;
create trigger trg_integrations_updated_at
  before update on public.integrations
  for each row execute function public.set_updated_at();
