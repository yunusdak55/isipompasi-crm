-- ============================================================================
-- 0025_agency_company_stats.sql
-- Ajans admin "Firmalar" sayfasi: her firmanin lead/pipeline/satis ozeti.
-- Eskiden TUM firmalarin TUM lead ve satis satirlari cekilip JS'te
-- gruplaniyordu (firma/lead sayisiyla dogrusal buyur). Simdi veritabaninda
-- tek sorguda, firma basina bir satir. SECURITY INVOKER: RLS aynen gecerli -
-- sadece admin tum firmalari gorur, diger roller kendi firmasini.
-- ============================================================================
create or replace function public.agency_company_stats()
returns table (
  id uuid,
  name text,
  city text,
  is_active boolean,
  lead_count bigint,
  pipeline_value numeric,
  total_sales numeric,
  sales_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id, c.name, c.city, c.is_active,
    coalesce(l.lead_count, 0),
    coalesce(l.pipeline_value, 0),
    coalesce(s.total_sales, 0),
    coalesce(s.sales_count, 0)
  from public.companies c
  left join (
    select company_id,
           count(*) as lead_count,
           sum(offered_amount) filter (where status not in ('won', 'lost')) as pipeline_value
    from public.leads
    group by company_id
  ) l on l.company_id = c.id
  left join (
    select company_id, sum(sale_amount) as total_sales, count(*) as sales_count
    from public.sales
    group by company_id
  ) s on s.company_id = c.id
  order by c.name;
$$;

revoke all on function public.agency_company_stats() from public;
grant execute on function public.agency_company_stats() to authenticated;
