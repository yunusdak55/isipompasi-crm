-- WhatsApp agent'in hizmet verdigi firmalarin hepsi sadece isi pompasi/klima/VRF
-- satmiyor - bazilari gunes paneli ve gunes enerjili su isitma sistemi de
-- sunuyor (kullanici spec: "Bu firmanin farkli farkli turlerde hizmetleri
-- oldugu icin (isi pompasi, gunes paneli, gunes enerjili su isitma sistemi)").
-- 0009'daki check constraint'i bu iki yeni kodu icerecek sekilde genisletiyoruz.
alter table public.leads drop constraint if exists leads_product_interest_check;

alter table public.leads
  add constraint leads_product_interest_check
  check (product_interest in (
    'heat_pump', 'air_conditioner', 'vrf', 'solar_panel', 'solar_water_heater', 'other'
  ));
