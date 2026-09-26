import { requireProfile } from "@/lib/auth/session";
import { getDueFollowups } from "@/lib/data/leads";
import { AppShell } from "@/components/layout/app-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Girisi olmayan kullanici burada /login'e yonlendirilir (middleware'e ek
  // ikinci savunma katmani - spec md.28 guvenlik oncelikli).
  //
  // PERF (jet hizi): profil (+ firma adi, tek sorguda embed) ile hatirlatma
  // zili verisi BIRBIRINE BAGIMLI DEGIL - eskiden art arda (profil -> firma ->
  // hatirlatmalar, 3 sirali ag turu) bekleniyordu, simdi PARALEL (tek tur).
  const [profile, dueFollowups] = await Promise.all([requireProfile(), getDueFollowups()]);

  return (
    <AppShell profile={profile} companyName={profile.company?.name ?? null} dueFollowups={dueFollowups}>
      {children}
    </AppShell>
  );
}
