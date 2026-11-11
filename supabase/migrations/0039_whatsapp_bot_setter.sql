-- ============================================================================
-- 0039_whatsapp_bot_setter.sql  (0038'in uzerine)
--
--  1) whatsapp_lines.bot_info: botun musteriye soyleyebilecegi firma bilgileri
--     (ör. odeme secenekleri). Firmaya ozel; panelde hat kartindan girilir.
--     Bot burada yazmayan hicbir firma bilgisini uydurmaz.
--  2) Kapanistan sonra 24 saat: musteri yazarsa (ör. "akşam 7'den sonra arayın")
--     bot kisa cevap verir (en fazla 3), yeni bilgi zaman cizelgesine
--     "Ek bilgi" notu olarak duser. Sonrasinda bot susar.
-- ============================================================================

alter table public.whatsapp_lines add column if not exists bot_info text;
do $$ begin
  alter table public.whatsapp_lines add constraint whatsapp_lines_bot_info_len check (char_length(bot_info) <= 2000);
exception when duplicate_object then null; end $$;

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
  v_last_conv public.whatsapp_conversations;
  v_label text;
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

  -- Konusma olmayan turler (tepki, sistem bildirimi, desteklenmeyen) yok sayilir.
  v_label := case p_type
    when 'text' then 'metin' when 'audio' then 'sesli mesaj' when 'voice' then 'sesli mesaj'
    when 'image' then 'fotoğraf' when 'video' then 'video' when 'document' then 'belge'
    when 'sticker' then 'çıkartma' when 'location' then 'konum' end;
  if v_label is null then
    return jsonb_build_object('action', 'ignore', 'reason', 'unsupported_type');
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

  -- Sohbet "yarida kaldi" diye kapandiysa ve musteri 72 saat icinde geri
  -- yazdiysa (ör. ertesi sabah cevap verdi) ayni sohbet yeniden acilir;
  -- bot kaldigi yerden devam eder.
  if not found then
    select * into v_last_conv
    from public.whatsapp_conversations
    where company_id = v_line.company_id and wa_phone = v_digits
    order by started_at desc
    limit 1
    for update;
    if found and v_last_conv.status = 'done' and v_last_conv.closed_reason = 'stale'
       and v_last_conv.completed_at > now() - interval '72 hours' then
      update public.whatsapp_conversations
      set status = 'active', completed_at = null, closed_reason = null
      where id = v_last_conv.id
      returning * into v_conv;
    -- On gorusme 24 saat icinde tamamlandiysa mesaj o sohbete eklenir ve bot
    -- "kapanistan sonra" kurallariyla kisa cevap verir (yeni bilgi nota duser).
    elsif found and v_last_conv.status = 'done'
       and coalesce(v_last_conv.closed_reason, 'complete') = 'complete'
       and v_last_conv.completed_at > now() - interval '24 hours' then
      v_conv := v_last_conv;
    end if;
  end if;

  if v_conv.id is null then
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
        and closed_reason is distinct from 'stale'
    ) then
      return jsonb_build_object('action', 'ignore', 'reason', 'recently_done');
    end if;
    -- WhatsApp profil adi yalnizca isim gibi duruyorsa kullanilir (emoji,
    -- rakam, "." vb. ise bos kalir; bot sohbette adi ogrenirse doldurur).
    v_name := nullif(btrim(regexp_replace(regexp_replace(coalesce(v_name, ''),
                '[^A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû .''-]', ' ', 'g'), '\s+', ' ', 'g')), '');
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

  -- Ses, resim, belge, konum, cikartma: icerik bota gonderilmez; gecmise
  -- "[sesli mesaj gönderildi]" gibi bir isaret dusulur ve bot kurallarina
  -- gore kisa bir cevapla (ör. "kısaca yazabilir misiniz?") devam eder.
  if p_type <> 'text' or v_text is null then
    v_text := case
      when p_type = 'location' and v_text is not null then '[konum gönderildi] ' || v_text
      else '[' || v_label || ' gönderildi]' end;
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
  v_phase text;
begin
  select * into v_conv from public.whatsapp_conversations where id = p_conversation_id;
  if not found then
    return jsonb_build_object('action', 'skip', 'reason', 'closed');
  end if;
  if v_conv.status = 'active' then
    v_phase := 'intake';
  elsif v_conv.status = 'done'
    and coalesce(v_conv.closed_reason, 'complete') = 'complete'
    and v_conv.completed_at > now() - interval '24 hours'
    -- kapanistan sonra en fazla 3 kisa cevap; sonrasi satis ekibinde
    and (select count(*) from public.whatsapp_messages
         where conversation_id = v_conv.id and role = 'bot' and created_at > v_conv.completed_at) < 3 then
    v_phase := 'aftercare';
  else
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
    'phase', v_phase,
    'bot_info', v_line.bot_info,
    'ad', jsonb_strip_nulls(jsonb_build_object(
      'headline', left(v_conv.referral ->> 'headline', 300),
      'body', left(v_conv.referral ->> 'body', 600))),
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
    -- Kapanistan sonraki 24 saat: cevap kaydedilir, yeni bilgi "Ek bilgi" notu
    -- olarak zaman cizelgesine duser; sohbet durumu ve lead alanlari degismez.
    if v_conv.status = 'done' and coalesce(v_conv.closed_reason, 'complete') = 'complete'
       and v_conv.completed_at > now() - interval '24 hours' then
      if v_reply is not null then
        insert into public.whatsapp_messages (conversation_id, role, body) values (v_conv.id, 'bot', v_reply);
      end if;
      if v_turn_note is not null then
        perform public.agent_upsert_lead(
          v_conv.company_id, public.wa_panel_phone(v_conv.wa_phone), null, null, null, null, null, null,
          'Ek bilgi (ön görüşmeden sonra): ' || v_turn_note);
      end if;
      return jsonb_build_object('ok', true, 'lead_id', v_conv.lead_id, 'aftercare', true);
    end if;
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
      closed_reason = case when v_complete then 'complete' else closed_reason end,
      completed_at = case when v_complete then now() else completed_at end
  where id = v_conv.id;

  return jsonb_build_object('ok', true, 'lead_id', v_conv.lead_id, 'complete', v_complete);
end;
$$;


revoke all on function public.wa_inbound(text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.wa_context(uuid, bigint) from public, anon, authenticated;
revoke all on function public.wa_bot_reply(uuid, text, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.wa_inbound(text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.wa_context(uuid, bigint) to service_role;
grant execute on function public.wa_bot_reply(uuid, text, jsonb, bigint) to service_role;
