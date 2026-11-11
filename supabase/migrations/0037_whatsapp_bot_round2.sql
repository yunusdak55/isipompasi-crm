-- ============================================================================
-- 0037_whatsapp_bot_round2.sql  (0036'nin uzerine; 20 senaryolu 2. testte bulunanlar)
--
--  1) Bot on gorusmeyi bitirdikten sonra musteri reklama tekrar tiklarsa bot
--     ayni sorulari bastan soruyordu. Artik 7 gun boyunca sessiz kalir.
--  2) Profil adi (ör. "AD Kuaför") sohbette soylenen addan (ör. "Ayşe Demir")
--     baskin geliyordu. Ad profilden geldiyse sohbetteki ad yazilir.
--  3) Tepki (mesaja emoji) gecmise "[reaction gönderildi]" diye dusuyordu:
--     artik yok sayilir. Konum mesaji harita linkiyle saklanir.
-- ============================================================================

alter table public.whatsapp_conversations add column if not exists profile_name text;

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

  -- Tepki (mesaja emoji) konusma degil: kaydedilmez, sohbet acmaz.
  if p_type = 'reaction' then
    return jsonb_build_object('action', 'ignore', 'reason', 'reaction');
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
    -- Son 7 gunde bot bu kisiyle on gorusmeyi bitirdiyse musteriyi satis
    -- temsilcisi devralmistir: reklama tekrar tiklasa da bot ayni sorulari
    -- bastan sormaz, sessiz kalir.
    if exists (
      select 1 from public.whatsapp_conversations
      where company_id = v_line.company_id and wa_phone = v_digits
        and status = 'done' and completed_at > now() - interval '7 days'
    ) then
      return jsonb_build_object('action', 'ignore', 'reason', 'recently_done');
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

    insert into public.whatsapp_conversations (company_id, line_id, wa_phone, lead_id, referral, profile_name)
    values (v_line.company_id, v_line.id, v_digits, v_lead, p_referral, concat_ws(' ', v_first, v_last))
    returning * into v_conv;
  end if;

  -- Ses, resim, belge vb.: bot cevap VERMEZ (satis temsilcisi dinler);
  -- gecmise isaret dusulur ki bot sonraki turda bunu bilsin.
  if p_type <> 'text' or v_text is null then  -- konum da burada: kaydedilir, cevap verilmez
    insert into public.whatsapp_messages (conversation_id, wamid, role, body)
    values (v_conv.id, p_wamid, 'customer',
            case when p_type = 'location' and v_text is not null
                 then '[konum gönderildi] ' || v_text
                 else '[' || coalesce(p_type, 'medya') || ' gönderildi]' end)
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

  -- Lead'in adi WhatsApp profilinden geldiyse (ör. "AD Kuaför") ve müşteri
  -- sohbette kendi adini soylediyse (ör. "Ayşe Demir") sohbetteki ad yazilir.
  -- Panelde elle girilmis ya da profilden farkli bir ad hic degismez.
  if v_first is not null then
    update public.leads l
    set first_name = v_first, last_name = v_last
    where l.id = v_conv.lead_id
      and lower(concat_ws(' ', v_first, v_last)) <> lower(coalesce(concat_ws(' ', l.first_name, l.last_name), ''))
      and (l.first_name is null
           or lower(regexp_replace(concat_ws(' ', l.first_name, l.last_name), '\s+', ' ', 'g'))
              = lower(regexp_replace(coalesce(v_conv.profile_name, ''), '\s+', ' ', 'g')));
  end if;

  update public.whatsapp_conversations
  set lead_id = v_conv.lead_id,
      collected_notes = v_conv.collected_notes,
      status = case when v_complete then 'done' else status end,
      completed_at = case when v_complete then now() else completed_at end
  where id = v_conv.id;

  return jsonb_build_object('ok', true, 'lead_id', v_conv.lead_id, 'complete', v_complete);
end;
$$;


revoke all on function public.wa_inbound(text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.wa_bot_reply(uuid, text, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.wa_inbound(text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.wa_bot_reply(uuid, text, jsonb, bigint) to service_role;
