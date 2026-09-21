-- ============================================================================
-- 0020_agency_prospect_activities.sql
-- Satis Gorusmeleri (agency_prospects) icin zaman cizelgesi/not gecmisi.
--
-- Spec: "bu kayıt edilen profillere giriş yaptığımda bir zaman çizelgesi
-- notlar kısmı olsun. ben buraya istediğim zaman NOT alabileyim ve aldığım
-- not burada TARİHİ VE ZAMANIYLA BİRLİKTE KENDİSİ GÖZÜKSÜN."
--
-- public.activities (lead zaman cizelgesi, 0001_init_schema.sql) ile AYNI
-- desen: manuel notlar + durum degisikligi/takip gibi olaylar da otomatik
-- burada birikir - "leadleri en iyi şekilde yönetme" hedefine hizmet eder.
-- ============================================================================

create table if not exists public.agency_prospect_activities (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.agency_prospects(id) on delete cascade,
  type text not null default 'note' check (type in ('note', 'status_change', 'system')),
  description text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);

comment on table public.agency_prospect_activities is 'Musteri adayi profilindeki zaman cizelgesi: manuel notlar + otomatik durum/takip kayitlari.';

create index if not exists idx_agency_prospect_activities_prospect on public.agency_prospect_activities (prospect_id, created_at desc);

alter table public.agency_prospect_activities enable row level security;

-- agency_prospects ile ayni kural: sadece admin (bkz. 0019_agency_prospects.sql).
create policy agency_prospect_activities_admin_all on public.agency_prospect_activities
  for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');
