-- ============================================================================
-- 0035_whatsapp_bot.sql
--
-- WhatsApp on gorusme botu (n8n workflow "WhatsApp Bot - Coklu Firma", kaynak:
-- n8n/whatsapp-bot.json, kurulum: docs/whatsapp-bot-kurulum.md).
--
-- TEK workflow BUTUN firmalara hizmet eder. Meta her mesajda hangi hatta
-- yazildigini (phone_number_id) gonderir; hangi hattin hangi firmaya ait oldugu
-- whatsapp_lines tablosundadir. Yeni musteri = bu tabloya bir satir (panel:
-- Entegrasyonlar). n8n'e dokunulmaz.
--
-- Akis (n8n yalnizca iki RPC cagirir, kararlarin hepsi burada, atomik):
--   1) wa_inbound   : gelen mesaj -> hat/firma bul, tekrar mesaji ele, "bot
--                     cevap versin mi" karari (hat acik mi, metin mi, reklamdan
--                     mi geldi ya da suren bir bot sohbeti mi), ilk mesajda
--                     lead'i hemen olustur, sohbet gecmisi + firmanin soru
--                     listesini dondur.
--   2) wa_bot_reply : botun cevabini kaydet, ogrenilen bilgileri lead'e isle,
--                     sohbet bitince zaman cizelgesine TEK ozet not yaz.
--   3) wa_close_stale: yarim kalan sohbetleri (3 saat sessiz) kapatir, o ana
--                     kadar ogrenileni not olarak yazar (n8n zamanlayici).
--
-- Guvenlik: tablolar RLS'li; okuma yalnizca ajans admini (ve firma sahibi kendi
-- hattini gorur). Fonksiyonlar SECURITY DEFINER, yalnizca service_role (n8n)
-- cagirabilir. Hicbir token/anahtar veritabaninda TUTULMAZ.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Hatlar
-- ----------------------------------------------------------------------------
create table if not exists public.whatsapp_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  phone_number_id text not null unique check (phone_number_id ~ '^[0-9A-Za-z_-]{3,64}$'),
  display_phone text,
  bot_enabled boolean not null default true,
  -- true: bot yalnizca Meta reklamindan gelen (referral bilgili) yeni sohbetlere
  -- girer; firma sahibinin es/dost yazismalarina karismaz.
  require_ad_referral boolean not null default true,
  -- true: cevap WhatsApp'a GONDERILMEZ, yalnizca kaydedilir (kurulum testi).
  test_mode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_whatsapp_lines_company on public.whatsapp_lines (company_id);

comment on table public.whatsapp_lines is 'Firmanin WhatsApp Cloud API hatti (Meta phone_number_id). Token TUTULMAZ; token n8n kimlik bilgisindedir.';

drop trigger if exists trg_whatsapp_lines_updated_at on public.whatsapp_lines;
create trigger trg_whatsapp_lines_updated_at
  before update on public.whatsapp_lines
  for each row execute function public.set_updated_at();

alter table public.whatsapp_lines enable row level security;

drop policy if exists "whatsapp_lines_admin_all" on public.whatsapp_lines;
create policy "whatsapp_lines_admin_all" on public.whatsapp_lines
  for all using (private.current_user_role() = 'admin')
  with check (private.current_user_role() = 'admin');

drop policy if exists "whatsapp_lines_owner_select" on public.whatsapp_lines;
create policy "whatsapp_lines_owner_select" on public.whatsapp_lines
  for select using (private.current_user_role() = 'owner' and company_id = private.current_user_company_id());

-- ----------------------------------------------------------------------------
-- 2) Sohbetler ve mesajlar (botun hafizasi; n8n yeniden baslasa da kaybolmaz)
-- ----------------------------------------------------------------------------
create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  line_id uuid references public.whatsapp_lines(id) on delete set null,
  wa_phone text not null,                 -- yalnizca rakam, ulke kodlu (905...)
  lead_id uuid references public.leads(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'done')),
  referral jsonb,                         -- Meta reklam bilgisi (ilk mesaj)
  collected_notes text,                   -- tur tur ogrenilenler (yarim kalirsa not olur)
  started_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_wa_conv_lookup on public.whatsapp_conversations (company_id, wa_phone, status, last_message_at desc);
create index if not exists idx_wa_conv_stale on public.whatsapp_conversations (status, last_message_at) where status = 'active';

create table if not exists public.whatsapp_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  wamid text unique,                      -- Meta mesaj kimligi: ayni mesaj iki kez islenmez
  role text not null check (role in ('customer', 'bot')),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_wa_msg_conv on public.whatsapp_messages (conversation_id, id);

alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;

drop policy if exists "wa_conv_select" on public.whatsapp_conversations;
create policy "wa_conv_select" on public.whatsapp_conversations
  for select using (
    private.current_user_role() = 'admin'
    or (private.current_user_role() = 'owner' and company_id = private.current_user_company_id())
  );

drop policy if exists "wa_msg_select" on public.whatsapp_messages;
create policy "wa_msg_select" on public.whatsapp_messages
  for select using (
    exists (
      select 1 from public.whatsapp_conversations c
      where c.id = conversation_id
        and (
          private.current_user_role() = 'admin'
          or (private.current_user_role() = 'owner' and c.company_id = private.current_user_company_id())
        )
    )
  );

-- ----------------------------------------------------------------------------
-- 3) Yardimcilar
-- ----------------------------------------------------------------------------
-- WhatsApp numarasi (905321234567) -> panelin bicimi (05321234567). Turkiye
-- disi numaralar +ulke kodlu kalir.
create or replace function public.wa_panel_phone(p_digits text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_digits ~ '^90[0-9]{10}$' then '0' || right(p_digits, 10)
    else '+' || p_digits
  end;
$$;

-- ----------------------------------------------------------------------------
-- 4) Gelen mesaj
-- ----------------------------------------------------------------------------
create or replace function public.wa_inbound(
  p_phone_number_id text,
  p_wamid text,
  p_from text,
  p_profile_name text default null,
  p_type text default 'text',
  p_text text default null,
  p_referral jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line public.whatsapp_lines;
  v_company public.companies;
  v_conv public.whatsapp_conversations;
  v_digits text := regexp_replace(coalesce(p_from, ''), '\D', '', 'g');
  v_text text := nullif(btrim(left(coalesce(p_text, ''), 4000)), '');
  v_name text := nullif(btrim(left(coalesce(p_profile_name, ''), 120)), '');
  v_first text;
  v_last text;
  v_lead uuid;
  v_inserted bigint;
  v_history jsonb;
  v_categories jsonb;
begin
  select * into v_line from public.whatsapp_lines where phone_number_id = p_phone_number_id;
  if not found then
    return jsonb_build_object('action', 'ignore', 'reason', 'unknown_line');
  end if;
  if not v_line.bot_enabled then
    return jsonb_build_object('action', 'ignore', 'reason', 'bot_off');
  end if;

  select * into v_company from public.companies where id = v_line.company_id;
  if not found or not v_company.is_active then
    return jsonb_build_object('action', 'ignore', 'reason', 'company_inactive');
  end if;

  if length(v_digits) < 10 then
    return jsonb_build_object('action', 'ignore', 'reason', 'bad_phone');
  end if;

  if p_wamid is not null and exists (select 1 from public.whatsapp_messages where wamid = p_wamid) then
    return jsonb_build_object('action', 'ignore', 'reason', 'duplicate');
  end if;

  -- Ayni numaradan ayni anda gelen iki mesaj iki sohbet acmasin.
  perform pg_advisory_xact_lock(hashtext(v_line.company_id::text || ':' || v_digits));

  select * into v_conv
  from public.whatsapp_conversations
  where company_id = v_line.company_id
    and wa_phone = v_digits
    and status = 'active'
    and last_message_at > now() - interval '72 hours'
  order by started_at desc
  limit 1
  for update;

  if not found then
    -- Yeni sohbet: yalnizca reklamdan gelen (ya da hat "herkese cevap ver"
    -- ayarliysa) METIN mesajiyla baslar.
    if v_line.require_ad_referral and p_referral is null then
      return jsonb_build_object('action', 'ignore', 'reason', 'no_referral');
    end if;
    if p_type <> 'text' or v_text is null then
      return jsonb_build_object('action', 'ignore', 'reason', 'not_text');
    end if;

    -- WhatsApp profil adi yalnizca isim gibi duruyorsa kullanilir (emoji,
    -- rakam, "." vb. ise bos kalir; bot sohbette adi ogrenirse doldurur).
    if v_name is not null and v_name ~ '^[A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû][A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû .''-]{1,59}$' then
      v_first := btrim(regexp_replace(v_name, '\s+\S+$', ''));
      v_last := nullif(btrim(substring(v_name from '\s(\S+)$')), '');
      if v_first = '' or v_last is null then v_first := v_name; v_last := null; end if;
    end if;

    v_lead := public.agent_upsert_lead(
      v_line.company_id, public.wa_panel_phone(v_digits), v_first, v_last,
      null, null, null, null, null
    );

    update public.leads
    set source = coalesce(source, 'whatsapp'),
        source_campaign = coalesce(source_campaign, left(coalesce(p_referral ->> 'headline', p_referral ->> 'source_id'), 200))
    where id = v_lead;

    insert into public.whatsapp_conversations (company_id, line_id, wa_phone, lead_id, referral)
    values (v_line.company_id, v_line.id, v_digits, v_lead, p_referral)
    returning * into v_conv;
  end if;

  -- Ses, resim, belge vb.: bot cevap VERMEZ (satis temsilcisi dinler);
  -- gecmise isaret dusulur ki bot sonraki turda bunu bilsin.
  if p_type <> 'text' or v_text is null then
    insert into public.whatsapp_messages (conversation_id, wamid, role, body)
    values (v_conv.id, p_wamid, 'customer', '[' || coalesce(p_type, 'medya') || ' gönderildi]')
    on conflict (wamid) do nothing;
    update public.whatsapp_conversations set last_message_at = now() where id = v_conv.id;
    return jsonb_build_object('action', 'ignore', 'reason', 'media', 'conversation_id', v_conv.id);
  end if;

  insert into public.whatsapp_messages (conversation_id, wamid, role, body)
  values (v_conv.id, p_wamid, 'customer', v_text)
  on conflict (wamid) do nothing
  returning id into v_inserted;
  if v_inserted is null then
    return jsonb_build_object('action', 'ignore', 'reason', 'duplicate');
  end if;

  update public.whatsapp_conversations set last_message_at = now() where id = v_conv.id;

  select coalesce(jsonb_agg(jsonb_build_object('role', m.role, 'body', m.body) order by m.id), '[]'::jsonb)
  into v_history
  from (
    select id, role, body from public.whatsapp_messages
    where conversation_id = v_conv.id
    order by id desc
    limit 40
  ) m;

  select coalesce(jsonb_agg(jsonb_build_object(
           'label', c.label, 'agent_code', c.agent_code, 'agent_questions', c.agent_questions
         ) order by c.sort_order, c.label), '[]'::jsonb)
  into v_categories
  from public.product_categories c
  where c.company_id = v_line.company_id and c.agent_code is not null;

  return jsonb_build_object(
    'action', 'reply',
    'conversation_id', v_conv.id,
    'lead_id', v_conv.lead_id,
    'company_name', v_company.name,
    'phone_number_id', v_line.phone_number_id,
    'to', v_digits,
    'test_mode', v_line.test_mode,
    'profile_name', v_name,
    'history', v_history,
    'categories', v_categories
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) Botun cevabi + ogrenilen bilgiler
-- ----------------------------------------------------------------------------
create or replace function public.wa_bot_reply(
  p_conversation_id uuid,
  p_reply text,
  p_fields jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv public.whatsapp_conversations;
  v_reply text := nullif(btrim(left(coalesce(p_reply, ''), 4000)), '');
  v_fields jsonb := coalesce(p_fields, '{}'::jsonb);
  v_complete boolean := coalesce((v_fields ->> 'conversation_complete')::boolean, false);
  v_turn_note text := nullif(btrim(left(coalesce(v_fields ->> 'summary_note', ''), 500)), '');
  v_final text := nullif(btrim(left(coalesce(v_fields ->> 'final_summary', ''), 2000)), '');
  v_interest text := v_fields ->> 'product_interest';
  v_area numeric;
  v_name text := nullif(btrim(left(coalesce(v_fields ->> 'customer_name', ''), 120)), '');
  v_first text;
  v_last text;
  v_note text;
begin
  select * into v_conv from public.whatsapp_conversations where id = p_conversation_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_conversation');
  end if;

  if v_reply is not null then
    insert into public.whatsapp_messages (conversation_id, role, body) values (v_conv.id, 'bot', v_reply);
  end if;

  if v_interest not in ('heat_pump', 'air_conditioner', 'vrf', 'solar_panel', 'solar_water_heater', 'other') then
    v_interest := null;
  end if;
  begin
    v_area := nullif(v_fields ->> 'area_m2', '')::numeric;
    if v_area <= 0 or v_area > 100000 then v_area := null; end if;
  exception when others then
    v_area := null;
  end;
  if v_name is not null then
    v_first := btrim(regexp_replace(v_name, '\s+\S+$', ''));
    v_last := nullif(btrim(substring(v_name from '\s(\S+)$')), '');
    if v_first = '' or v_last is null then v_first := v_name; v_last := null; end if;
  end if;

  if v_turn_note is not null then
    v_conv.collected_notes := concat_ws(E'\n', v_conv.collected_notes, '- ' || v_turn_note);
  end if;

  if v_complete then
    v_note := 'Ön görüşme: ' || coalesce(v_final, v_conv.collected_notes, 'Bilgiler alındı.');
  end if;

  v_conv.lead_id := public.agent_upsert_lead(
    v_conv.company_id, public.wa_panel_phone(v_conv.wa_phone), v_first, v_last,
    nullif(btrim(left(coalesce(v_fields ->> 'city', ''), 200)), ''),
    nullif(btrim(left(coalesce(v_fields ->> 'district', ''), 200)), ''),
    v_area, v_interest, v_note
  );

  update public.whatsapp_conversations
  set lead_id = v_conv.lead_id,
      collected_notes = v_conv.collected_notes,
      status = case when v_complete then 'done' else status end,
      completed_at = case when v_complete then now() else completed_at end
  where id = v_conv.id;

  return jsonb_build_object('ok', true, 'lead_id', v_conv.lead_id, 'complete', v_complete);
end;
$$;

-- ----------------------------------------------------------------------------
-- 6) Yarim kalan sohbetler: 3 saat sessizse kapat, ogrenileni not dus.
-- ----------------------------------------------------------------------------
create or replace function public.wa_close_stale(p_idle interval default interval '3 hours')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.whatsapp_conversations;
  n integer := 0;
begin
  for r in
    select * from public.whatsapp_conversations
    where status = 'active' and last_message_at < now() - p_idle
    for update skip locked
  loop
    if r.collected_notes is not null then
      perform public.agent_upsert_lead(
        r.company_id, public.wa_panel_phone(r.wa_phone), null, null, null, null, null, null,
        'Ön görüşme (müşteri yanıtı yarıda kaldı): ' || r.collected_notes
      );
    end if;
    update public.whatsapp_conversations set status = 'done', completed_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.wa_inbound(text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.wa_bot_reply(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.wa_close_stale(interval) from public, anon, authenticated;
revoke all on function public.wa_panel_phone(text) from public, anon, authenticated;
grant execute on function public.wa_inbound(text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.wa_bot_reply(uuid, text, jsonb) to service_role;
grant execute on function public.wa_close_stale(interval) to service_role;
grant execute on function public.wa_panel_phone(text) to service_role;

-- GERI ALMA:
--   drop function if exists public.wa_close_stale(interval);
--   drop function if exists public.wa_bot_reply(uuid, text, jsonb);
--   drop function if exists public.wa_inbound(text, text, text, text, text, text, jsonb);
--   drop function if exists public.wa_panel_phone(text);
--   drop table if exists public.whatsapp_messages;
--   drop table if exists public.whatsapp_conversations;
--   drop table if exists public.whatsapp_lines;
