import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import type { Database } from "@/lib/types/database.types";
import { buildInstrumentedFetch } from "@/lib/supabase/fetch-with-timeout";

/**
 * SADECE admin-only server action'larda kullanilir (yeni firma/kullanici
 * olusturma vb.). Service role key kullanir - RLS'i bypass eder. Cagiran
 * kod HER ZAMAN once requireProfile().role === 'admin' kontrolu yapmali.
 * ASLA client tarafinda ("use client") import edilmemeli.
 */
export async function createAdminClient() {
  // GOZLEMLENEBILIRLIK: bkz. server.ts'teki ayni gerekce.
  const requestId = (await headers()).get("x-request-id") ?? undefined;

  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    // PERF (donma duzeltmesi, bkz. fetch-with-timeout.ts).
    global: { fetch: buildInstrumentedFetch(requestId) },
  });
}
