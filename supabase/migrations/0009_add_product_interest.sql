-- Lead'in hangi urun/hizmetle ilgilendigini gosteren manuel secilebilir alan
-- (kullanici karari: hem isi pompasi hem klima/VRF satan "iklimlendirme"
-- firmalari icin lead'leri urun bazinda ayirt edebilmek + Raporlar'da urun
-- ilgi dagilimi gosterebilmek icin). Nullable - eski leadler icin bos kalir,
-- ileride n8n agent tarafindan da doldurulabilir.
alter table public.leads
  add column if not exists product_interest text
  check (product_interest in ('heat_pump', 'air_conditioner', 'vrf', 'other'));
