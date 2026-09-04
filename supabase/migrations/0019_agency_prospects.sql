-- ============================================================================
-- 0019_agency_prospects.sql
-- Ajansin KENDI musteri adayi (satis gorusmesi yaptigi isi pompasi
-- kurulumcusu firmalar) takibi icin tablo. "leads" tablosuyla KARISTIRILMAMALI:
-- leads = ajansin MUSTERISI olan firmalarin KENDI musterileri (tenant verisi,
-- company_id ile ayrilir). agency_prospects = ajansin kendisinin, yeni musteri
-- kazanmak icin aradigi firmalar - hicbir tenant'a ait degil, sadece admin
-- gorur/yonetir (company_id yok, RLS tek basli "sadece admin").
-- ============================================================================

create table if not exists public.agency_prospects (
  id uuid primary key default gen_random_uuid(),

  company_name text not null,
  contact_name text,
  phone text,
  notes text,

  status text not null default 'new' check (
    status in ('new', 'contacted', 'followup', 'won', 'lost')
  ),

  next_followup_at timestamptz,
  next_followup_note text,
  last_contact_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid()
);

comment on table public.agency_prospects is 'Ajansin kendi satis gorusmesi yaptigi musteri adayi firmalar (yeni musteri kazanma huniisi) - leads tablosundaki tenant/musteri verisiyle ilgisi yoktur, sadece admin erisir.';
comment on column public.agency_prospects.status is 'new=henuz aranmadi, contacted=goruusuldu, followup=takipte, won=musteri oldu, lost=kayip.';

create trigger trg_agency_prospects_updated_at
  before update on public.agency_prospects
  for each row execute function public.set_updated_at();

alter table public.agency_prospects enable row level security;

drop policy if exists "agency_prospects_admin_all" on public.agency_prospects;
create policy "agency_prospects_admin_all" on public.agency_prospects
for all using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create index if not exists idx_agency_prospects_next_followup on public.agency_prospects (next_followup_at);
create index if not exists idx_agency_prospects_status on public.agency_prospects (status);
