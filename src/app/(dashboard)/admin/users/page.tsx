import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { getAllUsersWithCompany, getCompaniesForSelect } from "@/lib/data/admin";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { UserActiveToggle } from "@/components/admin/user-active-toggle";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";
import { USER_ROLE_LABELS } from "@/lib/constants/lead";
import { getInitials } from "@/lib/utils";

/** Ajans admin'in tum musteri firmalardaki kullanicilari yonettigi panel. */
export default async function AdminUsersPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const [users, companies] = await Promise.all([getAllUsersWithCompany(), getCompaniesForSelect()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-6 shadow-elevated-lg sm:p-7">
        <HvacBackdrop intensity="hero" />
        <div className="relative">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Kullanıcılar</h1>
          <p className="mt-1 text-sm text-white/55">
            Müşteri firmalarınız için giriş hesabı oluşturun ve mevcut hesapları yönetin.
          </p>
        </div>
      </div>

      {companies.length === 0 ? (
        <Card className="animate-slide-up">
          <CardBody>
            <p className="text-sm text-ink-600">
              Önce en az bir firma eklemeniz gerekiyor —{" "}
              <a href="/admin/companies" className="font-medium text-accent-600 hover:underline">
                Firmalar
              </a>{" "}
              sayfasından ekleyebilirsiniz.
            </p>
          </CardBody>
        </Card>
      ) : (
        <CreateUserForm companies={companies} />
      )}

      <Card className="animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-ink-400" />
            Tüm Kullanıcılar
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 px-4 py-10 text-center">
              <p className="text-sm font-medium text-ink-900">Henüz kullanıcı yok</p>
              <p className="text-sm text-ink-600">Yukarıdan ilk kullanıcıyı ekleyin.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="border-b border-line text-xs font-medium uppercase tracking-wide text-ink-600">
                  <tr>
                    <th className="px-5 py-3 font-medium">Kullanıcı</th>
                    <th className="px-5 py-3 font-medium">Firma</th>
                    <th className="px-5 py-3 font-medium">Rol</th>
                    <th className="px-5 py-3 font-medium">Aktif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {users.map((u, index) => (
                    <tr
                      key={u.id}
                      className="animate-slide-up transition-colors duration-150 hover:bg-white/[0.03]"
                      style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-xs font-semibold text-brand-100">
                            {getInitials(u.fullName)}
                          </span>
                          <div>
                            <p className="font-medium text-ink-900">{u.fullName ?? "—"}</p>
                            <p className="text-xs text-ink-600">{u.email ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-ink-900">{u.companyName ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone="ink">{USER_ROLE_LABELS[u.role]}</Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <UserActiveToggle userId={u.id} isActive={u.isActive} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
