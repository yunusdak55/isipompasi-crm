import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getDueFollowups } from "@/lib/data/leads";
import { AppShell } from "@/components/layout/app-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Girisi olmayan kullanici burada /login'e yonlendirilir (middleware'e ek
  // ikinci savunma katmani - spec md.28 guvenlik oncelikli).
  const profile = await requireProfile();

  let companyName: string | null = null;
  if (profile.company_id) {
    const supabase = await createClient();
    const { data } = await supabase.from("companies").select("name").eq("id", profile.company_id).single();
    companyName = data?.name ?? null;
  }

  const dueFollowups = await getDueFollowups();

  return (
    <AppShell profile={profile} companyName={companyName} dueFollowups={dueFollowups}>
      {children}
    </AppShell>
  );
}
