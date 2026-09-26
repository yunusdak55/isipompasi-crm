"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clearFailures, clientIp, isRateLimited, recordFailure } from "@/lib/security/rate-limit";

// Hesap basina 10 dk'da 8, IP basina 10 dk'da 30 basarisiz deneme.
const WINDOW_MS = 10 * 60 * 1000;
const EMAIL_LIMIT = 8;
const IP_LIMIT = 30;

export type LoginState = { error: string | null };

export async function signInAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "E-posta ve şifre zorunludur." };
  }
  if (email.length > 254 || password.length > 256) {
    return { error: "E-posta veya şifre hatalı." };
  }

  const emailKey = `login:e:${email.toLowerCase()}`;
  const ipKey = `login:i:${clientIp(await headers())}`;
  if (isRateLimited(emailKey, EMAIL_LIMIT, WINDOW_MS) || isRateLimited(ipKey, IP_LIMIT, WINDOW_MS)) {
    return { error: "Çok fazla hatalı deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    recordFailure(emailKey, WINDOW_MS);
    recordFailure(ipKey, WINDOW_MS);
    return { error: "E-posta veya şifre hatalı." };
  }
  clearFailures(emailKey);

  // Pasif kullanici / askidaki firma / profili olmayan hesap panele GIRMEZ.
  // (Veritabani zaten tum veri erisimini keser - bkz. migration 0026 - burasi
  // kullaniciya net bir mesaj verir ve acik oturumu birakmaz.)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id, is_active, company:companies(name)")
    .eq("id", data.user.id)
    .maybeSingle();

  const blocked =
    !profile || !profile.is_active || (profile.role !== "admin" && !!profile.company_id && !profile.company);
  if (blocked) {
    await supabase.auth.signOut();
    return {
      error: !profile
        ? "Hesabınız henüz yapılandırılmamış. Lütfen ajansla iletişime geçin."
        : "Hesabınız pasif durumda. Lütfen yöneticinizle iletişime geçin.",
    };
  }

  // Ajans admin'in kendine ait bir firmasi yok - /dashboard tum firmalarin
  // karisik/filtresiz verisini gosterir, admin icin anlamli olan tek yer
  // Firmalar paneli (bkz. src/app/page.tsx'teki ayni mantik).
  redirect(profile.role === "admin" ? "/admin/companies" : "/dashboard");
}
