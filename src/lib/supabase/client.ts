import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database.types";

/**
 * Tarayici (client component) tarafinda kullanilacak Supabase client'i.
 * Sadece NEXT_PUBLIC_ ile baslayan, tarayiciya gonderilmesi guvenli
 * degiskenleri kullanir. RLS her zaman aktiftir.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
