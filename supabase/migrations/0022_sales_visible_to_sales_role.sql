-- ============================================================================
-- 0022_sales_visible_to_sales_role.sql
--
-- Spec (kullanici): "Satışlar" sayfasindaki (Aylik Satis Trendi, Kime Ne
-- Satildi, Satis Personeli Performansi) veriler 'sales' rolundeki hesaplara
-- HIC gorunmuyordu - 0002_rls_policies.sql'de "ciro hassas veri" varsayimiyla
-- bilerek sadece owner/admin'e acilmisti. Kullanici bu karari degistirdi:
-- satis personeli de TUM firmanin cirosunu/satislarini gorebilsin (ekip
-- seffafligi - meslektaslarin rakamlari da dahil, sadece kendi satislari
-- degil).
--
-- BILEREK DEGISMEYEN: bu SADECE gorme (select) izni - bir satis kaydini
-- OLUSTURMA/DUZENLEME (write) hala sadece owner/admin'de (bkz. actions.ts:
-- upsertSaleAction, "role === 'sales'" kontrolu; ayrica asagidaki
-- "sales_write" politikasi da degistirilmedi).
-- ============================================================================

drop policy if exists "sales_select" on public.sales;
create policy "sales_select" on public.sales
for select using (
  public.current_user_role() = 'admin'
  or (
    public.current_user_role() in ('owner', 'sales')
    and company_id = public.current_user_company_id()
  )
);
