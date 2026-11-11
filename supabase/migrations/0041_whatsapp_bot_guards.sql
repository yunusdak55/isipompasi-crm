-- 0041: WhatsApp botu koruma ve hata kaydi (2026-11-11)
--
-- 1) wa_context: maliyet siniri (sohbet basina 12, hat basina saatte 150 bot cevabi).
-- 2) wa_log_error: n8n'deki hata workflow'u botta bir adim hata verirse buraya yazar;
--    admin panelinde Denetim Kaydi'nda "Bot hatasi" olarak gorunur. Ayni hata
--    10 dakika icinde tekrar yazilmaz (hata firtinasinda kayit sismesin).

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

  -- MALIYET SINIRI (0041): trol ya da sahte istek yapay zeka kredisini yakamasin.
  -- Normal bir on gorusme 4-8 bot mesaji; 12'den sonra bot susar, sohbet yarida
  -- kalinca wa_close_stale musterinin yazdiklariyla lead'i yine CRM'e yazar.
  if v_phase = 'intake' and (select count(*) from public.whatsapp_messages
                             where conversation_id = v_conv.id and role = 'bot') >= 12 then
    return jsonb_build_object('action', 'skip', 'reason', 'reply_cap');
  end if;
  -- Hat basina saatte en fazla 150 bot cevabi (~25-30 yeni musteri/saat).
  if (select count(*) from public.whatsapp_messages m
      join public.whatsapp_conversations c on c.id = m.conversation_id
      where c.line_id = v_line.id and m.role = 'bot' and m.created_at > now() - interval '1 hour') >= 150 then
    return jsonb_build_object('action', 'skip', 'reason', 'line_rate_cap');
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

revoke all on function public.wa_context(uuid, bigint) from public, anon, authenticated;
grant execute on function public.wa_context(uuid, bigint) to service_role;

create or replace function public.wa_log_error(p_workflow text, p_node text, p_message text, p_execution text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_msg text := left(coalesce(nullif(btrim(p_message), ''), 'bilinmeyen hata'), 500);
  v_node text := left(coalesce(p_node, '?'), 120);
begin
  if exists (
    select 1 from public.audit_log
    where action = 'BOT_ERROR' and at > now() - interval '10 minutes'
      and changes ->> 'node' = v_node and changes ->> 'message' = v_msg
  ) then
    return false;
  end if;
  insert into public.audit_log (action, table_name, row_id, changes)
  values ('BOT_ERROR', 'whatsapp_bot', left(p_execution, 64),
          jsonb_build_object('workflow', left(p_workflow, 120), 'node', v_node, 'message', v_msg));
  return true;
end;
$$;

revoke all on function public.wa_log_error(text, text, text, text) from public, anon, authenticated;
grant execute on function public.wa_log_error(text, text, text, text) to service_role;
