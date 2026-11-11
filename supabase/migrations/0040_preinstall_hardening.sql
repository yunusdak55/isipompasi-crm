-- 0040: Kurulum öncesi sıkılaştırma (2026-11-11)
--
-- 1) Supabase performans uyarıları:
--    - whatsapp_conversations yabancı anahtarlarında index yoktu (lead silinince ya da hat silinince tam tarama).
--    - whatsapp_lines'ta aynı işlem için iki izin politikası vardı (her sorguda ikisi de çalışıyordu).
--    - WhatsApp politikaları fonksiyonları satır başına çağırıyordu; (select ...) ile sorgu başına bire iner.
-- 2) Metin alanlarına üst sınır: elle ya da betikle gönderilen megabaytlık metinler veritabanını şişiremez.
--    Sınırlar formlardaki gerçek kullanımın çok üstünde (en uzun mevcut not 298 karakter).
--    Bot girdileri zaten fonksiyonlarda kırpılıyor (mesaj 4000, not 5000, isim 120).
-- 3) wa_close_stale: yarıda kalan sohbetin notu artık müşterinin yazdıklarını da içerir. Bot hiç cevap
--    veremediyse (ör. yapay zekâ hatası) bunu açıkça yazar; satış ekibi müşteriyi yine görür ve arar.

-- 1) index ve politikalar ------------------------------------------------------------------------
create index if not exists idx_wa_conv_lead_id on public.whatsapp_conversations (lead_id);
create index if not exists idx_wa_conv_line_id on public.whatsapp_conversations (line_id);

drop policy if exists whatsapp_lines_admin_all on public.whatsapp_lines;
drop policy if exists whatsapp_lines_owner_select on public.whatsapp_lines;
create policy whatsapp_lines_select on public.whatsapp_lines for select using (
  (select private.current_user_role()) = 'admin'
  or ((select private.current_user_role()) = 'owner' and company_id = (select private.current_user_company_id()))
);
create policy whatsapp_lines_admin_insert on public.whatsapp_lines for insert
  with check ((select private.current_user_role()) = 'admin');
create policy whatsapp_lines_admin_update on public.whatsapp_lines for update
  using ((select private.current_user_role()) = 'admin')
  with check ((select private.current_user_role()) = 'admin');
create policy whatsapp_lines_admin_delete on public.whatsapp_lines for delete
  using ((select private.current_user_role()) = 'admin');

drop policy if exists wa_conv_select on public.whatsapp_conversations;
create policy wa_conv_select on public.whatsapp_conversations for select using (
  (select private.current_user_role()) = 'admin'
  or ((select private.current_user_role()) = 'owner' and company_id = (select private.current_user_company_id()))
);

drop policy if exists wa_msg_select on public.whatsapp_messages;
create policy wa_msg_select on public.whatsapp_messages for select using (
  exists (
    select 1 from public.whatsapp_conversations c
    where c.id = whatsapp_messages.conversation_id
      and ((select private.current_user_role()) = 'admin'
           or ((select private.current_user_role()) = 'owner' and c.company_id = (select private.current_user_company_id())))
  )
);

drop policy if exists companies_update_admin_or_owner on public.companies;
create policy companies_update_admin_or_owner on public.companies for update
  using ((select private.current_user_role()) = 'admin'
         or ((select private.current_user_role()) = 'owner' and id = (select private.current_user_company_id())))
  with check ((select private.current_user_role()) = 'admin'
         or ((select private.current_user_role()) = 'owner' and id = (select private.current_user_company_id())));

-- 2) metin üst sınırları ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select * from (values
      -- Bot sınırlarıyla uyumlu (wa_bot_reply: isim 120, il/ilçe 200): botun kaydı hiçbir zaman reddedilmez.
      -- leads.notes bilerek yok: bot her sohbette notu sona ekliyor (agent_upsert_lead); sınır botu kırabilirdi.
      ('leads', 'first_name', 150), ('leads', 'last_name', 150), ('leads', 'phone', 40), ('leads', 'email', 254),
      ('leads', 'city', 250), ('leads', 'district', 250), ('leads', 'next_followup_note', 1000),
      ('leads', 'source_campaign', 500), ('leads', 'product_interest', 500),
      ('activities', 'description', 10000), ('followups', 'note', 2000),
      ('discovery_visits', 'location', 300), ('discovery_visits', 'outcome_note', 5000),
      ('sales', 'notes', 5000), ('sales', 'product_service', 300),
      ('salespeople', 'full_name', 120), ('product_categories', 'label', 120),
      ('companies', 'name', 200), ('companies', 'city', 100), ('companies', 'contact_name', 120),
      ('companies', 'contact_phone', 40), ('companies', 'contact_email', 254),
      ('profiles', 'full_name', 120), ('profiles', 'phone', 40),
      ('agency_prospects', 'company_name', 200), ('agency_prospects', 'contact_name', 120),
      ('agency_prospects', 'phone', 40), ('agency_prospects', 'notes', 10000),
      ('agency_prospects', 'next_followup_note', 1000), ('agency_prospect_activities', 'description', 10000)
    ) v(t, c, n)
  loop
    execute format('alter table public.%I drop constraint if exists %I', r.t, r.t || '_' || r.c || '_len');
    execute format('alter table public.%I add constraint %I check (char_length(%I) <= %s) not valid',
                   r.t, r.t || '_' || r.c || '_len', r.c, r.n);
    execute format('alter table public.%I validate constraint %I', r.t, r.t || '_' || r.c || '_len');
  end loop;
end $$;

-- 3) yarıda kalan sohbet notu ------------------------------------------------------------------------
create or replace function public.wa_close_stale(p_idle interval default '03:00:00'::interval)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  r public.whatsapp_conversations;
  n integer := 0;
  v_bot_count integer;
  v_said text;
  v_note text;
begin
  for r in
    select * from public.whatsapp_conversations
    where status = 'active' and last_message_at < now() - p_idle
    for update skip locked
  loop
    -- Yeniden açılıp tekrar yarıda kalan sohbette yeni bilgi yoksa aynı not ikinci kez yazılmaz.
    if r.stale_snapshot is distinct from coalesce(r.collected_notes, '') then
      select count(*) into v_bot_count from public.whatsapp_messages m
      where m.conversation_id = r.id and m.role = 'bot';
      -- Müşterinin son 3 mesajı (en fazla 400 karakter): bot not çıkaramadıysa satış ekibi ne istendiğini görsün.
      select left(string_agg(x.body, ' / ' order by x.id), 400) into v_said
      from (select m.id, m.body from public.whatsapp_messages m
            where m.conversation_id = r.id and m.role = 'customer'
            order by m.id desc limit 3) x;

      v_note := case
        when r.collected_notes is not null then
          'Ön görüşme (müşteri yanıtı yarıda kaldı): ' || r.collected_notes
        when v_bot_count = 0 then
          'WhatsApp''tan yazdı ama bot cevap veremedi (teknik sorun olabilir); müşteriyi doğrudan arayın.'
          || coalesce(' Müşterinin yazdıkları: ' || v_said, '')
        else
          'Ön görüşme (müşteri yanıtı yarıda kaldı): Reklamdan yazdı, botun sorularına cevap vermedi.'
          || coalesce(' Müşterinin yazdıkları: ' || v_said, '')
      end;

      perform public.agent_upsert_lead(
        r.company_id, public.wa_panel_phone(r.wa_phone), null, null, null, null, null, null, v_note
      );
    end if;
    update public.whatsapp_conversations
    set status = 'done', completed_at = now(), closed_reason = 'stale',
        stale_snapshot = coalesce(r.collected_notes, '')
    where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$function$;

revoke all on function public.wa_close_stale(interval) from public, anon, authenticated;
grant execute on function public.wa_close_stale(interval) to service_role;
