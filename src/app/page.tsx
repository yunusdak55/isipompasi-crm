import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";

/**
 * Kok sayfa: oturum durumuna gore yonlendirir.
 * (Middleware zaten korumali rotalari kapatiyor; burasi "/" icin ayrica
 * dogru ilk yonlendirmeyi yapar.)
 */
export default async function RootPage() {
  const profile = await getCurrentProfile();

  if (profile) {
    // Ajans admin'in kendine ait bir firmasi yok - /dashboard tum firmalarin
    // karisik/filtresiz verisini gosterir (spec: "benim panelimde neden bir
    // crm sistemi var" - admin icin anlamli olan tek yer Firmalar paneli).
    redirect(profile.role === "admin" ? "/admin/companies" : "/dashboard");
  }

  redirect("/login");
}
