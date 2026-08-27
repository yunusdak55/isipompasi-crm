import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

/**
 * SADECE admin-only server action'larda kullanilir (yeni firma/kullanici
 * olusturma vb.). Service role key kullanir - RLS'i bypass eder. Cagiran
 * kod HER ZAMAN once requireProfile().role === 'admin' kontrolu yapmali.
 * ASLA client tarafinda ("use client") import edilmemeli.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
