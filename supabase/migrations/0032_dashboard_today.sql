-- ============================================================================
-- 0032 - "Bugun" ekrani (Dashboard) icin tek turluk ozet: dashboard_today()
--
-- AMAC: Dashboard artik "bugun ne yapmaliyim?" ekrani. Gerekli tum veri
-- (bugunku takip / geciken / yeni sayilari + her birinin ilk N kaydi +
-- onumuzdeki 7 gunun takip yogunlugu + bu ayin satisi + satis hatti
-- sayaclari) TEK RPC ile, TEK veritabani turunda gelir. Eskiden "Gecikenler"
-- sayisi icin tum lead satirlari uygulamaya cekilip JS'te suzuluyordu (bkz.
-- src/lib/data/leads.ts getLeadsOverdue) - dashboard en cok acilan sayfa
-- oldugu icin bu kabul edilemezdi.
--
-- GUVENLIK: SECURITY INVOKER - RLS cagiran kullanici icin aynen gecerli
-- (sales rolu yalniz kendine atanmis leadleri, owner firmasini gorur; baska
-- firmanin verisi ASLA sayilmaz). Yalnizca authenticated calistirabilir.
--
-- KURAL TEKRARI UYARISI: "gecikmis" ve "yeni" tanimlari uygulamada TEK yerde
-- yasar (src/lib/utils.ts isLeadOverdue / isLeadNew). Bu fonksiyon AYNI
-- kurallari SQL'de uygular; ikisinin sapmamasi icin
-- scripts/verify-dashboard-today.mts rastgele 5.000 leadlik test projesinde
-- SQL sonucunu uygulama kurallariyla birebir karsilastirir. Kural degisirse
-- IKISI BIRDEN guncellenmeli:
--   gecikmis  = kapanmamis (won/lost degil) VE takip tarihi dolu VE
--               takip tarihi < simdi - 24 saat VE takip zamanindan bu yana
--               aktivite yok (coalesce(last_activity_at, created_at) < takip).
--   takip(due)= kapanmamis VE takip tarihi [simdi-24sa, gun sonu) araliginda
--               (dunku ama henuz 24 saati dolmamis takipler de BURADA - aksi
--               halde ne "bugun" ne "geciken" olarak gorunmez, kaybolurdu).
--               due_carry = bunlardan gun basindan ONCE olanlar ("dunden kalan");
--               ekran bu sayiyi acikca belirtir, boylece "bugunku" sayisi
--               dunden kalanlari sessizce icermis olmaz.
--               "Tamamlandi" diye bir cikarim YAPILMAZ: arandi mi, gorusuldu
--               mu bilinemez - takip, tarih degisene/kaldirilana kadar listede.
--   yeni      = kapanmamis VE son 24 saatte olusturulmus (durumdan/takipten
--               bagimsiz: "bir lead 24 saate kadar yenidir").
--   hafta     = takip tarihi gun sonundan itibaren 6 gunluk pencerede, gun gun
--               sayim (0 = yarin ... 5 = 6 gun sonra). Bugun sutunu uygulama
--               tarafinda `due` sayisidir.
--   bu ay     = sale_date [ay basi, sonraki ay basi) araliginda satis sayisi/cirosu.
-- Zaman sinirlari (simdi / gun sonu / ay siniri) UYGULAMADAN parametre olarak
-- gelir: Turkiye gunu ve uygulama saati tek kaynak (src/lib/time.ts), DB saat
-- dilimi ya da saat sapmasi sonucu etkilemez.
-- ============================================================================

create or replace function public.dashboard_today(
  p_now timestamptz,
  p_day_start timestamptz,
  p_day_end timestamptz,
  p_month_start date,
  p_month_end date,
  p_overdue_hours integer default 24,
  p_new_hours integer default 24,
  p_due_limit integer default 8,
  p_other_limit integer default 5
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with classified as (
    select
      l.id,
      l.first_name,
      l.last_name,
      l.phone,
      l.city,
      l.status,
      l.offered_amount,
      l.next_followup_at,
      l.created_at,
      case
        when l.next_followup_at is null then null
        when l.next_followup_at < p_now - make_interval(hours => p_overdue_hours) then
          case when coalesce(l.last_activity_at, l.created_at) < l.next_followup_at then 'overdue' end
        when l.next_followup_at < p_day_end then 'due'
      end as bucket,
      (l.created_at >= p_now - make_interval(hours => p_new_hours)) as is_new,
      case
        when l.next_followup_at >= p_day_end and l.next_followup_at < p_day_end + interval '6 days'
          then floor(extract(epoch from (l.next_followup_at - p_day_end)) / 86400)::int
      end as day_offset
    from public.leads l
    where l.status not in ('won', 'lost')
  )
  select jsonb_build_object(
    'counts', jsonb_build_object(
      'overdue', count(*) filter (where bucket = 'overdue'),
      'due',     count(*) filter (where bucket = 'due'),
      'due_carry', count(*) filter (where bucket = 'due' and next_followup_at < p_day_start),
      'new',     count(*) filter (where is_new)
    ),
    -- Onumuzdeki gunler: { "0": yarin, "1": 2 gun sonra, ... } (bos gunler yok).
    'week', (
      select coalesce(jsonb_object_agg(day_offset::text, n), '{}'::jsonb)
      from (select day_offset, count(*) as n from classified where day_offset is not null group by day_offset) w
    ),
    -- Gecikenler: en AZ geciken en ustte (gecikme gun sayisi kucukten buyuge).
    'overdue', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.next_followup_at desc, x.id), '[]'::jsonb)
      from (
        select id, first_name, last_name, phone, city, status, offered_amount, next_followup_at, created_at
        from classified where bucket = 'overdue'
        order by next_followup_at desc, id
        limit p_other_limit
      ) x
    ),
    -- Bugunku takipler: saat sirasiyla (en erken en ustte).
    'due', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.next_followup_at, x.id), '[]'::jsonb)
      from (
        select id, first_name, last_name, phone, city, status, offered_amount, next_followup_at, created_at
        from classified where bucket = 'due'
        order by next_followup_at, id
        limit p_due_limit
      ) x
    ),
    -- Yeni gelenler (son 24 saat): en son gelen en ustte.
    'new', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc, x.id), '[]'::jsonb)
      from (
        select id, first_name, last_name, phone, city, status, offered_amount, next_followup_at, created_at
        from classified where is_new
        order by created_at desc, id
        limit p_other_limit
      ) x
    ),
    'month', (
      select jsonb_build_object('sales_count', count(*), 'revenue', coalesce(sum(s.sale_amount), 0))
      from public.sales s
      where s.sale_date >= p_month_start and s.sale_date < p_month_end
    ),
    -- Mevcut satis hatti sayaclari (ayri bir tur atmamak icin ayni cagriya dahil).
    'stats', public.dashboard_stats()
  )
  from classified;
$$;

revoke all on function public.dashboard_today(timestamptz, timestamptz, timestamptz, date, date, integer, integer, integer, integer) from public, anon;
grant execute on function public.dashboard_today(timestamptz, timestamptz, timestamptz, date, date, integer, integer, integer, integer) to authenticated;
