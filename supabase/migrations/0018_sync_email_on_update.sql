-- ============================================================================
-- 0018_sync_email_on_update.sql
-- BULUNAN GERCEK HATA: public.handle_new_user() trigger'i SADECE auth.users'a
-- yeni satir eklendiginde (INSERT) calisiyordu. Bir kullanicinin e-postasi
-- Supabase Dashboard'dan (Authentication > Users) SONRADAN degistirildiginde
-- (UPDATE), profiles.email kolonu HIC guncellenmiyordu - eski/yanlis e-posta
-- kalici olarak orada kaliyordu. Bunu canli veride yakaladik: Ajans Admin
-- hesabinin auth.users.email'i yunusdak55@gmail.com'a degismisti ama
-- profiles.email hala "admin@test.local" gosteriyordu - /admin/users
-- sayfasindaki "Tüm Kullanıcılar" listesi YANLIS e-posta gosteriyordu.
--
-- Bu trigger, e-posta (ve olur da degisirse full_name/role/company_id
-- meta verisi) her guncellendiginde profiles'i otomatik senkron tutar.
-- ============================================================================

create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id
    and email is distinct from new.email;
  return new;
end;
$$;

comment on function public.handle_user_updated() is 'auth.users.email degistiginde profiles.email''i senkron tutar - eskiden sadece INSERT''te senkronize oluyordu, sonradan degisen e-postalar profiles''ta eski kaliyordu.';

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email on auth.users
  for each row execute function public.handle_user_updated();
