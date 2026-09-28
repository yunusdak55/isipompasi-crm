-- WhatsApp AI agent'in hizmet listesi ve ihtiyac analizi sorulari artik n8n
-- promptunda SABIT DEGIL - her firmanin kendi product_categories satirlarindan
-- OTOMATIK okunuyor (kullanici karari: "bu hizmetler firmaya gore degisecek,
-- ben de onu firmaya gore guncelleyecem" - 2026-09-27). Boylece yeni bir
-- musteri/kategori eklendiginde n8n workflow'una hic dokunulmasina gerek
-- kalmiyor, agent otomatik uyum sagliyor.

-- agent_code: bu kategorinin leads.product_interest kodu (bkz. 0009/0028
-- migration'lari). Null ise agent bu kategoriyi TANIMAZ, ihtiyac analizi
-- sorularina dahil etmez (ör. firma icin sadece raporlama amacli tutulan,
-- agent'in bilmesi gerekmeyen bir kategori olabilir).
alter table public.product_categories
  add column if not exists agent_code text
  check (agent_code in ('heat_pump', 'air_conditioner', 'vrf', 'solar_panel', 'solar_water_heater', 'other'));

-- agent_questions: bu hizmet icin agent'in sirayla soracagi ihtiyac analizi
-- sorulari (metin dizisi/JSON array). Bos/null ise agent genel soru setini
-- kullanir (il/ilce + metrekare).
alter table public.product_categories
  add column if not exists agent_questions jsonb;

comment on column public.product_categories.agent_code is
  'WhatsApp AI agent icin: leads.product_interest kodu. Null = agent bu kategoriyi tanimiyor.';
comment on column public.product_categories.agent_questions is
  'WhatsApp AI agent icin: sirayla sorulacak sorular (["Soru 1?", "Soru 2?", ...]). Bos/null = genel il/ilce+m2 sorulari kullanilir.';
