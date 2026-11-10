-- ============================================================================
-- 0036_whatsapp_bot_fixes.sql  (0035'in uzerine; 10 senaryolu testte bulunanlar)
--
--  1) Reklamdan gelen ILK mesaj fotograf/ses ise lead ve sohbet yine acilir
--     (eskiden musteri hic kaydedilmiyor, sonraki metinleri de yok sayiliyordu).
--  2) Pes pese gelen mesajlara TEK cevap: wa_inbound artik yalnizca kaydeder;
--     n8n birkac saniye bekleyip wa_context ile "bu hala son mesaj mi" diye
--     sorar. wa_bot_reply da cevap uretilirken yeni mesaj geldiyse cevabi atar.
-- ============================================================================

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
    -- ayarliysa) mesajla baslar. Ilk mesaj fotograf/ses olsa da lead acilir;
    -- bot ilk METIN mesajinda konusmaya baslar.
    if v_line.require_ad_referral and p_referral is null then
      return jsonb_build_object('action', 'ignore', 'reason', 'no_referral');
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

  return jsonb_build_object('action', 'reply', 'conversation_id', v_conv.id, 'message_id', v_inserted);
end;
$$;

create or replace function public.wa_context(p_conversation_id uuid, p_message_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_conv public.whatsapp_conversations;
  v_line public.whatsapp_lines;
  v_company public.companies;
  v_history jsonb;
  v_categories jsonb;
begin
  select * into v_conv from public.whatsapp_conversations where id = p_conversation_id;
  if not found or v_conv.status <> 'active' then
    return jsonb_build_object('action', 'skip', 'reason', 'closed');
  end if;
  -- Musteri bu arada yeni mesaj attiysa cevabi o mesajin turu verir
  -- (peş peşe "Merhaba" + "ısı pompası..." = TEK cevap).
  if exists (
    select 1 from public.whatsapp_messages
    where conversation_id = v_conv.id and role = 'customer' and id > p_message_id
  ) then
    return jsonb_build_object('action', 'skip', 'reason', 'newer_message');
  end if;

  select * into v_line from public.whatsapp_lines where id = v_conv.line_id;
  select * into v_company from public.companies where id = v_conv.company_id;
  if v_line.id is null or not v_line.bot_enabled then
    return jsonb_build_object('action', 'skip', 'reason', 'bot_off');
  end if;

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
  where c.company_id = v_conv.company_id and c.agent_code is not null;

  return jsonb_build_object(
    'action', 'reply',
    'conversation_id', v_conv.id,
    'message_id', p_message_id,
    'lead_id', v_conv.lead_id,
    'company_name', v_company.name,
    'phone_number_id', v_line.phone_number_id,
    'to', v_conv.wa_phone,
    'test_mode', v_line.test_mode,
    'history', v_history,
    'categories', v_categories
  );
end;
$$;

create or replace function public.wa_bot_reply(
  p_conversation_id uuid,
  p_reply text,
  p_fields jsonb default '{}'::jsonb,
  p_message_id bigint default null
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

  -- Bu cevap uretilirken musteri yeni mesaj attiysa bu cevap gonderilmez;
  -- yeni mesajin turu butun gecmisi gorerek tek cevap verir.
  if p_message_id is not null and exists (
    select 1 from public.whatsapp_messages
    where conversation_id = v_conv.id and role = 'customer' and id > p_message_id
  ) then
    return jsonb_build_object('ok', false, 'reason', 'superseded');
  end if;
  if v_conv.status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'closed');
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


drop function if exists public.wa_bot_reply(uuid, text, jsonb);

revoke all on function public.wa_inbound(text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.wa_context(uuid, bigint) from public, anon, authenticated;
revoke all on function public.wa_bot_reply(uuid, text, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.wa_inbound(text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.wa_context(uuid, bigint) to service_role;
grant execute on function public.wa_bot_reply(uuid, text, jsonb, bigint) to service_role;

-- 3) Yarim kalan sohbet: musteri hicbir soruya cevap vermediyse de not dusulur
--    (satis personeli "reklamdan yazdi ama cevap vermedi" bilgisini gorsun).
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
    perform public.agent_upsert_lead(
      r.company_id, public.wa_panel_phone(r.wa_phone), null, null, null, null, null, null,
      'Ön görüşme (müşteri yanıtı yarıda kaldı): '
        || coalesce(r.collected_notes, 'Reklamdan yazdı, botun sorularına cevap vermedi.')
    );
    update public.whatsapp_conversations set status = 'done', completed_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.wa_close_stale(interval) from public, anon, authenticated;
grant execute on function public.wa_close_stale(interval) to service_role;
