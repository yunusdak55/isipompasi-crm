-- ============================================================================
-- 0034_sales_role_can_record_sales.sql
--
-- Spec (kullanici, 2026-10-05): "Satış personeli hesabı da satış girebilsin."
-- 0022'de satis personeline satislari GORME izni verilmis, YAZMA bilerek yalnizca
-- owner/admin'de birakilmisti. Sonuc: satis personeli lead sayfasinda satis
-- bolumunu hic gormuyor, Kanban'da karti "Satış"a surukleyince hata aliyordu.
--
-- YENI KURAL: 'sales' rolu, YALNIZCA KENDISINE ATANMIS leadler icin satis kaydi
-- olusturabilir ve duzeltebilir (leads tablosundaki gorme/guncelleme kuraliyla
-- ayni sinir: assigned_salesperson = kendisi, ayni firma). Baska satis personelinin
-- ya da atanmamis bir leadin satisini yazamaz. SILME hala yalnizca owner/admin.
-- owner/admin kurallari DEGISMEDI.
--
-- GERI ALMA: bu dosyadaki iki politikayi, 'sales' dalini cikararak yeniden olusturun
-- (0027 sonrasi hali: admin OR (owner AND company_id = current company)).
-- ============================================================================

drop policy if exists "sales_insert" on public.sales;
create policy "sales_insert" on public.sales
for insert with check (
  (select private.current_user_role()) = 'admin'
  or (
    (select private.current_user_role()) = 'owner'
    and company_id = (select private.current_user_company_id())
  )
  or (
    (select private.current_user_role()) = 'sales'
    and company_id = (select private.current_user_company_id())
    and exists (
      select 1 from public.leads l
      where l.id = sales.lead_id
        and l.company_id = sales.company_id
        and l.assigned_salesperson = (select auth.uid())
    )
  )
);

drop policy if exists "sales_update" on public.sales;
create policy "sales_update" on public.sales
for update using (
  (select private.current_user_role()) = 'admin'
  or (
    (select private.current_user_role()) = 'owner'
    and company_id = (select private.current_user_company_id())
  )
  or (
    (select private.current_user_role()) = 'sales'
    and company_id = (select private.current_user_company_id())
    and exists (
      select 1 from public.leads l
      where l.id = sales.lead_id
        and l.company_id = sales.company_id
        and l.assigned_salesperson = (select auth.uid())
    )
  )
) with check (
  (select private.current_user_role()) = 'admin'
  or (
    (select private.current_user_role()) = 'owner'
    and company_id = (select private.current_user_company_id())
  )
  or (
    (select private.current_user_role()) = 'sales'
    and company_id = (select private.current_user_company_id())
    and exists (
      select 1 from public.leads l
      where l.id = sales.lead_id
        and l.company_id = sales.company_id
        and l.assigned_salesperson = (select auth.uid())
    )
  )
);
