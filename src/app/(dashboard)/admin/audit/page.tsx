import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { getAuditLog } from "@/lib/data/audit";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";

const ACTION_LABELS: Record<string, { label: string; tone: "success" | "warning" | "danger" }> = {
  INSERT: { label: "Ekleme", tone: "success" },
  UPDATE: { label: "Değişiklik", tone: "warning" },
  DELETE: { label: "Silme", tone: "danger" },
};

const dateTime = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "Europe/Istanbul",
});

/**
 * Denetim kaydi: kullanici rol/aktiflik/e-posta, firma, entegrasyon ve satis
 * (ciro) degisikliklerinin DEGISTIRILEMEZ dokumu (DB tetikleyicisi yazar,
 * kimse duzenleyemez/silemez - bkz. migration 0026). Sadece ajans admini gorur.
 */
export default async function AdminAuditPage() {
  // PERF: profil ile veri ayni ag turunda (bkz. dashboard/page.tsx); veri RLS'li oturumla okunur.
  const [profile, events] = await Promise.all([requireProfile(), getAuditLog(200)]);
  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-6 shadow-elevated-lg sm:p-7">
        <HvacBackdrop intensity="hero" />
        <div className="relative">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Denetim Kaydı</h1>
          <p className="mt-1 text-sm text-white/55">
            Kim, ne zaman, neyi değiştirdi — kullanıcı, firma, entegrasyon ve satış değişikliklerinin silinemez kaydı (son 200 olay).
          </p>
        </div>
      </div>

      <Card className="animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-ink-400" />
            Son Olaylar
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {events.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-ink-600">Henüz kayıtlı bir olay yok.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-line text-xs font-medium uppercase tracking-wide text-ink-600">
                  <tr>
                    <th className="px-5 py-3 font-medium">Zaman</th>
                    <th className="px-5 py-3 font-medium">İşlem</th>
                    <th className="px-5 py-3 font-medium">Kayıt</th>
                    <th className="px-5 py-3 font-medium">Yapan</th>
                    <th className="px-5 py-3 font-medium">Ayrıntı</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {events.map((e) => {
                    const a = ACTION_LABELS[e.action] ?? { label: e.action, tone: "warning" as const };
                    return (
                      <tr key={e.id} className="transition-colors duration-150 hover:bg-white/[0.03]">
                        <td className="whitespace-nowrap px-5 py-3 text-ink-600">{dateTime.format(new Date(e.at))}</td>
                        <td className="px-5 py-3">
                          <Badge tone={a.tone}>{a.label}</Badge>
                        </td>
                        <td className="px-5 py-3 text-ink-900">
                          {e.tableName}
                          {e.companyName ? <span className="block text-xs text-ink-600">{e.companyName}</span> : null}
                        </td>
                        <td className="px-5 py-3 text-ink-900">{e.actor}</td>
                        <td className="px-5 py-3 text-ink-600">{e.summary}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
