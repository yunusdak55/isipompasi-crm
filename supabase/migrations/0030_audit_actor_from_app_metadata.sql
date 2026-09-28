-- ============================================================================
-- DUZELTME (denetim bulgusu, canli-kullanici testi 2026-10-01):
-- "Ajans admin panelinden yeni firma/kullanici olusturunca, Denetim
-- Kaydi'nda bu islem 'Yapan: Sistem' gorunuyor, gercek admin degil."
--
-- SEBEP: Yeni firma sahibi/personel girisi `auth.admin.createUser()`
-- (Supabase Admin API, service_role) ile olusuyor - bu cagri PostgREST/JWT
-- baglaminin DISINDA calisir. `profiles` satirini yaratan handle_new_user()
-- tetikleyicisi calisirken `auth.uid()` NULL'dir (gercek bir kullanici
-- oturumu yok), audit_row_change() de bu NULL'u actor_id olarak yazar.
-- `lib/data/audit.ts` NULL actor_id'yi "Sistem" olarak gosterir.
--
-- NEDEN UYGULAMA KODUNDAN SONRADAN DUZELTILMEDI: audit_log'un yazma yetkisi
-- HICBIR role verilmemis, sadece bu tetikleyici yazar (bkz. asagidaki NOT
-- + database.types.ts: `Insert: never; Update: never`) - bu KASITLI: "kimse,
-- admin dahil, denetim kaydini SONRADAN degistiremez" guvencesi. Bu satiri
-- app kodundan UPDATE ile "duzeltmek" o guvenceyi kirar. Dogru cozum,
-- TETIKLEYICININ KENDISININ, satir INSERT edilirken, service_role
-- cagrilarinda GERCEK actor'u bulabilmesi: cagiran server action artik
-- `app_metadata.created_by` alanina kendi (requireAdmin() ile dogrulanmis)
-- id'sini yaziyor (bkz. app/(dashboard)/admin/actions.ts). Bu tetikleyici,
-- auth.uid() NULL ise VE tablo `profiles` ise, o degeri auth.users'tan okuyup
-- KULLANIR - satir hala TEK SEFERDE, INSERT aninda yaziliyor, sonradan asla
-- degistirilmiyor.
-- ============================================================================

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_changes jsonb;
  v_row_id text;
  v_company uuid;
  v_actor uuid;
  v_sensitive constant text[] := array['config'];   -- ham icerigi loga yazma
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new) - v_sensitive;
    v_changes := v_new;
    v_row_id := v_new ->> 'id';
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old) - v_sensitive;
    v_changes := v_old;
    v_row_id := v_old ->> 'id';
  else
    v_old := to_jsonb(old) - v_sensitive;
    v_new := to_jsonb(new) - v_sensitive;
    select coalesce(jsonb_object_agg(k, jsonb_build_object('old', v_old -> k, 'new', v_new -> k)), '{}'::jsonb)
      into v_changes
      from jsonb_object_keys(v_new) as k
      where (v_old -> k) is distinct from (v_new -> k)
        and k not in ('updated_at', 'updated_by');
    if v_changes = '{}'::jsonb then
      return new; -- yalniz updated_at degisti: gurultu, kaydetme
    end if;
    v_row_id := v_new ->> 'id';
  end if;

  v_company := coalesce(
    nullif(coalesce(v_new, v_old) ->> 'company_id', '')::uuid,
    case when tg_table_name = 'companies' then nullif(coalesce(v_new, v_old) ->> 'id', '')::uuid end
  );

  -- YENI: auth.uid() NULL ise (service_role/Admin API cagrisi - JWT baglami
  -- yok) VE bu bir 'profiles' INSERT'i ise (handle_new_user() ile hesap
  -- provizyonu), gercek actor'u auth.users.raw_app_meta_data.created_by'dan
  -- oku. Cagiran server action bu alani KENDI dogrulanmis admin id'siyle
  -- doldurur (bkz. admin/actions.ts createCompanyWithOwnerAction/
  -- createCompanyUserAction). Baska hicbir durumda (normal JWT'li istekler)
  -- bu dala hic girilmez, auth.uid() zaten dolu gelir.
  v_actor := auth.uid();
  if v_actor is null and tg_table_name = 'profiles' and tg_op = 'INSERT' then
    select nullif(raw_app_meta_data ->> 'created_by', '')::uuid
      into v_actor
      from auth.users
      where id = new.id;
  end if;

  insert into public.audit_log (actor_id, action, table_name, row_id, company_id, changes)
  values (v_actor, tg_op, tg_table_name, v_row_id, v_company, v_changes);

  return coalesce(new, old);
end;
$$;
