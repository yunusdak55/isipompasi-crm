-- ============================================================================
-- DUZELTME (denetim bulgusu, canli-kullanici testi 2026-10-01, Agent B raporu):
-- "Firma Ayarları → Firma Bilgileri formu 'Kaydedildi' gösteriyor ama
-- sayfa yenilenince degerler eskisine donuyor - firma sahibi kendi firma
-- bilgisini ASLA degistiremiyor ve bunu fark etmiyor."
--
-- KOK SEBEP: migration 0002'deki "companies_update_admin" politikasi UPDATE'i
-- SADECE role='admin' icin izin veriyordu - 'owner' hic dusunulmemisti.
-- settings/page.tsx + CompanyEditForm ise BASTAN BERI owner'in kendi firma
-- bilgisini duzenleyebilecegini varsayarak yazilmis (bkz. `canEdit = role ===
-- "owner"`) - UI ile RLS arasinda bir tutarsizlik, RLS sessizce 0 satir
-- guncelledigi icin uygulama katmani da hatayi fark edemiyordu (Supabase
-- `.update()` 0 satir eslesince hata DONDURMEZ).
--
-- COZUM: (1) owner'a SADECE KENDI firmasi (id = current_user_company_id())
-- icin UPDATE izni eklendi. (2) Ayni "profiles.is_active" icin zaten var olan
-- (migration 0024) korumayla AYNI desen: `is_active` (firma askiya alma/
-- aktif etme) SADECE admin degistirebilir - owner'a genis bir UPDATE izni
-- vermek, dolayli yoldan kendi askiya alinmis hesabini kendi kendine tekrar
-- aktif etmesine izin vermemeli. name/city/contact_* alanlari owner'a acik.
-- ============================================================================

drop policy if exists "companies_update_admin" on public.companies;
create policy "companies_update_admin_or_owner" on public.companies
for update using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and id = public.current_user_company_id())
)
with check (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'owner' and id = public.current_user_company_id())
);

-- Ayricalikli kolon korumasi: profiles icin migration 0024'teki
-- protect_profile_privileged_columns() ile AYNI desen.
create or replace function public.protect_company_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and coalesce(public.current_user_role(), '') <> 'admin' then
    if new.is_active is distinct from old.is_active then
      raise exception 'Firmayı aktif/pasif yapmayı sadece ajans admini değiştirebilir.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_company_privileged_columns on public.companies;
create trigger trg_protect_company_privileged_columns
  before update on public.companies
  for each row execute function public.protect_company_privileged_columns();
