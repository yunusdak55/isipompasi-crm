"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Topbar'daki cikis butonu tarafindan kullanilir. */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
