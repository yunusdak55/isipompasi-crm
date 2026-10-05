-- ============================================================================
-- 0033_lead_phone_unique_and_agent_upsert.sql        *** ONERI - UYGULANMADI ***
--
-- Bu dosya BILEREK supabase/migrations/ DISINDA duruyor: canli veritabanina
-- henuz uygulanmadi. Onaylanirsa: (1) `npm run backup`, (2) Supabase SQL
-- Editor'de calistir, (3) dosyayi supabase/migrations/ altina tasi,
-- (4) `npm run security:check`. Ayrinti: docs/performans-raporu-2026-10-05.md.
--
-- SORUN (veri butunlugu): leads tablosunda (company_id, phone) icin UNIQUE
-- kisit yok. n8n akisi "once ara, yoksa ekle" yapiyor; ayni musteriden art
-- arda gelen iki WhatsApp mesaji ayni anda islenirse ikisi de "kayit yok"
-- gorup IKI lead acabilir. Ayrica numara bicimi tutarsiz: canli veride
-- (2026-10-05, salt-okunur sayim) 310 kayit "05XXXXXXXXX", 1 kayit
-- "+90XXXXXXXXXX" biciminde - duz metin esitligi ayni kisiyi iki ayri lead
-- sayar. Su an cift kayit YOK (311 lead; ham ve normalize sayim: 0 cift),
-- yani indeks bugun sorunsuz olusur.
--
-- COZUM:
--  A) Numaranin son 10 hanesi (ulke/alan on eki ve bosluk/tire/parantez
--     atilmis hali) uzerinden firma basina UNIQUE indeks.
--  B) Agent icin DAR, ATOMIK bir RPC: tek cagrida "varsa guncelle, yoksa
--     ekle" + not ekleme + aktivite satiri. Yalnizca kontratta izinli
--     alanlara dokunur (docs/whatsapp-agent-contract.md); status,
--     last_contact_at, assigned_salesperson, next_followup_*, priority gibi
--     insan alanlarina DOKUNAMAZ. Boylece n8n'deki 3-4 ayri adim (ve yaris
--     kosulu) tek guvenli cagriya iner.
--
-- ETKISI (karar gerektirir): panelden elle "Yeni Lead" eklerken ayni firmada
-- ayni telefon ikinci kez girilirse kayit reddedilir ("Bu kayıt zaten mevcut").
-- Ayni numarayla bilerek ikinci lead acma ihtiyaci varsa A adimini uygulamayin.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A) Firma + normalize telefon tekilligi. Ifade dogrudan indekste (ayri bir
--    fonksiyon degil): EXECUTE yetkisi gerektirmez, RLS/rol fark etmez.
--    10 haneden kisa (eksik/gecersiz) numaralar kapsam disi - yanlis eslesme olmasin.
-- ----------------------------------------------------------------------------
create unique index if not exists uq_leads_company_phone_norm
  on public.leads (company_id, (right(regexp_replace(phone, '\D', '', 'g'), 10)))
  where length(regexp_replace(phone, '\D', '', 'g')) >= 10;

-- ----------------------------------------------------------------------------
-- B) Agent RPC. SECURITY DEFINER + bos search_path; YALNIZCA service_role
--    cagirabilir (anon/authenticated'a yetki verilmez - bkz. docs/security.md).
-- ----------------------------------------------------------------------------
create or replace function public.agent_upsert_lead(
  p_company_id uuid,
  p_phone text,
  p_first_name text default null,
  p_last_name text default null,
  p_city text default null,
  p_district text default null,
  p_area_m2 numeric default null,
  p_product_interest text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_note text := nullif(btrim(left(coalesce(p_note, ''), 5000)), '');
  v_stamped text;
  v_lead_id uuid;
begin
  if length(v_digits) < 10 then
    raise exception 'gecersiz telefon' using errcode = '22023';
  end if;

  if v_note is not null then
    v_stamped := '[' || to_char(now() at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI') || '] ' || v_note;
  end if;

  insert into public.leads as l (company_id, phone, first_name, last_name, city, district, area_m2, product_interest, notes)
  values (
    p_company_id, btrim(p_phone),
    nullif(btrim(left(p_first_name, 200)), ''), nullif(btrim(left(p_last_name, 200)), ''),
    nullif(btrim(left(p_city, 200)), ''), nullif(btrim(left(p_district, 200)), ''),
    p_area_m2, p_product_interest, v_stamped
  )
  on conflict (company_id, (right(regexp_replace(phone, '\D', '', 'g'), 10)))
    where length(regexp_replace(phone, '\D', '', 'g')) >= 10
  do update set
    -- Kontrat: yeni bilgi gelmediyse eski deger KORUNUR; var olan isim ezilmez.
    first_name       = coalesce(l.first_name, excluded.first_name),
    last_name        = coalesce(l.last_name, excluded.last_name),
    city             = coalesce(excluded.city, l.city),
    district         = coalesce(excluded.district, l.district),
    area_m2          = coalesce(excluded.area_m2, l.area_m2),
    product_interest = coalesce(excluded.product_interest, l.product_interest),
    -- Notlar silinmez, altina eklenir.
    notes            = case
                         when excluded.notes is null then l.notes
                         when l.notes is null or l.notes = '' then excluded.notes
                         else l.notes || E'\n' || excluded.notes
                       end
  returning l.id into v_lead_id;

  if v_note is not null then
    -- Bu insert, mevcut tetikleyiciyle leads.last_activity_at'i de gunceller.
    insert into public.activities (lead_id, company_id, type, description)
    values (v_lead_id, p_company_id, 'note', 'WhatsApp: ' || v_note);
  end if;

  return v_lead_id;
end;
$$;

revoke all on function public.agent_upsert_lead(uuid, text, text, text, text, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.agent_upsert_lead(uuid, text, text, text, text, text, numeric, text, text) to service_role;

-- GERI ALMA:
--   drop function if exists public.agent_upsert_lead(uuid, text, text, text, text, text, numeric, text, text);
--   drop index if exists public.uq_leads_company_phone_norm;
