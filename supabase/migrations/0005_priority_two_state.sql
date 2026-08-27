-- ============================================================================
-- 0005_priority_two_state.sql
-- Oncelik sistemini uc durumdan (hot/medium/cold) iki duruma indirger
-- (spec: "Sadece Sicak / Soguk olsun, Orta tamamen kaldirilacak").
--
-- Mevcut 'medium' kayitlar 'cold' olarak normalize edilir (veri kaybi yok,
-- sadece siniflandirma daraliyor). Varsayilan deger de 'cold' oluyor ki yeni
-- olusturulan bir lead otomatik olarak "Sicak" gibi gorunmesin.
-- ============================================================================

update public.leads
set priority = 'cold'
where priority = 'medium';

alter table public.leads alter column priority set default 'cold';

alter table public.leads drop constraint if exists leads_priority_check;
alter table public.leads add constraint leads_priority_check check (priority in ('hot', 'cold'));
