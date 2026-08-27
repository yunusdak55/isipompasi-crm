"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };

export async function signInAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "E-posta ve şifre zorunludur." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "E-posta veya şifre hatalı." };
  }

  // Ajans admin'in kendine ait bir firmasi yok - /dashboard tum firmalarin
  // karisik/filtresiz verisini gosterir, admin icin anlamli olan tek yer
  // Firmalar paneli (bkz. src/app/page.tsx'teki ayni mantik).
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  redirect(profile?.role === "admin" ? "/admin/companies" : "/dashboard");
}
