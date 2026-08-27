import { createClient } from "@/lib/supabase/server";
import type { ProductCategory } from "@/lib/types/domain";

/** Bir firmanin kendi tanimladigi urun/hizmet kategorileri (spec: her firma kendi urun cizgisini yonetir). */
export async function getProductCategories(companyId: string): Promise<ProductCategory[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("product_categories")
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order")
    .order("label");

  if (error) {
    console.error("getProductCategories error:", error.message);
    return [];
  }

  return data ?? [];
}
