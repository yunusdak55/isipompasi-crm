-- 0042: WhatsApp'a gönderilemeyen bot cevabı geçmişten silinir (2026-11-11).
--
-- Sorun (canlı denemede görüldü): wa_bot_reply cevabı gönderimden ÖNCE kaydediyor. Meta gönderimi
-- reddedince (ör. geçersiz anahtar) cevap müşteriye hiç gitmedi ama geçmişte kaldı. Bot konumu üç kez
-- sorduğunu sandı ve dördüncüde müşterinin hiç görmediği sorular için "Hazır olduğunuzda konumunuzu
-- yazmanız yeterli" dedi.
-- Çözüm: n8n gönderim hata verirse bu fonksiyonu çağırır; sohbetin aynı metinli son bot mesajı
-- (son 15 dakika) silinir. Toplanan bilgiler (not, il, m²) kalır: onlar müşterinin yazdıklarından gelir.

create or replace function public.wa_unsend_bot_reply(p_conversation_id uuid, p_body text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id bigint;
begin
  select m.id into v_id from public.whatsapp_messages m
  where m.conversation_id = p_conversation_id
    and m.role = 'bot'
    and m.body = nullif(btrim(left(coalesce(p_body, ''), 4000)), '')
    and m.created_at > now() - interval '15 minutes'
  order by m.id desc
  limit 1;
  if v_id is null then
    return false;
  end if;
  delete from public.whatsapp_messages where id = v_id;
  return true;
end;
$function$;

revoke all on function public.wa_unsend_bot_reply(uuid, text) from public, anon, authenticated;
grant execute on function public.wa_unsend_bot_reply(uuid, text) to service_role;
