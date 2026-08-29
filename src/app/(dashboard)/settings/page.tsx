import { redirect } from "next/navigation";
import { Building2, Users, Contact, SlidersHorizontal, Bell } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getAssignableProfiles } from "@/lib/data/leads";
import { getSalespeople } from "@/lib/data/salespeople";
import { getProductCategories } from "@/lib/data/product-categories";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CompanyEditForm } from "@/components/settings/company-edit-form";
import { CreateSalespersonForm } from "@/components/settings/create-salesperson-form";
import { RemoveSalespersonButton } from "@/components/settings/remove-salesperson-button";
import { CreateCategoryForm } from "@/components/settings/create-category-form";
import { RemoveCategoryButton } from "@/components/settings/remove-category-button";
import { USER_ROLE_LABELS } from "@/lib/constants/lead";
import { getInitials } from "@/lib/utils";
import type { Company } from "@/lib/types/domain";

function SettingsField({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-ink-600">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-900">{value}</dd>
    </div>
  );
}

function NotificationRow({ label, description, active }: { label: string; description: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-line px-3.5 py-3">
      <div>
        <p className="text-sm font-medium text-ink-900">{label}</p>
        <p className="mt-0.5 text-xs text-ink-600">{description}</p>
      </div>
      {active ? (
        <Badge tone="success" className="shrink-0">
          Aktif
        </Badge>
      ) : (
        <span
          aria-hidden
          className="relative inline-flex h-5 w-9 shrink-0 cursor-not-allowed items-center rounded-full bg-white/10 opacity-60"
          title="Yakında"
        >
          <span className="absolute right-0.5 h-4 w-4 rounded-full bg-white shadow-sm" />
        </span>
      )}
    </div>
  );
}

export default async function SettingsPage() {
  const profile = await requireProfile();

  // Ajans admin'in kendine ait bir firmasi yok (company_id = null) - bu sayfa
  // tamamen firma baglamina gore kurulu, admin'e boş "Hesabınıza bağlı bir
  // firma yok" kartlari gostermek yerine kendi alanina yonlendiriyoruz
  // (sidebar zaten bu linki admin'e hic göstermiyor, bu sadece dogrudan
  // URL ile gelinen durumu kapatiyor).
  if (profile.role === "admin") {
    redirect("/admin/companies");
  }

  const supabase = await createClient();
  // admin buraya hic ulasmiyor (yukarida yonlendiriliyor) - kalan roller owner/sales.
  const canEdit = profile.role === "owner";

  let company: Company | null = null;
  if (profile.company_id) {
    const { data } = await supabase.from("companies").select("*").eq("id", profile.company_id).single();
    company = data;
  }

  const users = profile.company_id ? await getAssignableProfiles(profile.company_id) : [];
  const salespeople = profile.company_id ? await getSalespeople(profile.company_id) : [];
  const categories = profile.company_id ? await getProductCategories(profile.company_id) : [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Firma Ayarları</h1>
        <p className="text-sm text-ink-600">Firma bilgileri, kullanıcılar ve satış tercihleri.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card hoverable className="animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-ink-400" />
              Firma Bilgileri
            </CardTitle>
          </CardHeader>
          <CardBody>
            {!company ? (
              <p className="text-sm text-ink-600">Hesabınıza bağlı bir firma yok.</p>
            ) : canEdit ? (
              <CompanyEditForm company={company} />
            ) : (
              <dl className="grid grid-cols-2 gap-4">
                <SettingsField label="Firma Adı" value={company.name} />
                <SettingsField label="Şehir" value={company.city ?? "—"} />
                <SettingsField label="İletişim Kişisi" value={company.contact_name ?? "—"} />
                <SettingsField label="Telefon" value={company.contact_phone ?? "—"} />
                <SettingsField label="E-posta" value={company.contact_email ?? "—"} className="col-span-2" />
              </dl>
            )}
          </CardBody>
        </Card>

        <Card hoverable className="animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-ink-400" />
              Kullanıcılar
            </CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            {/* Salt okunur - firma sahibinin artik hicbir hesap olusturma/
                kaldirma yetkisi yok (spec: "Firma sahipleri herhangi bir
                hesap oluşturma yetkisine SAHİP OLMASIN"). Gercek "sales"
                hesaplari sadece ajans tarafindan /admin panelinden acilir. */}
            {users.length === 0 ? (
              <p className="text-sm text-ink-600">Henüz kullanıcı yok.</p>
            ) : (
              users.map((u) => (
                <div key={u.id} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-xs font-semibold text-brand-100">
                    {getInitials(u.full_name)}
                  </span>
                  <p className="flex-1 truncate text-sm font-medium text-ink-900">{u.full_name ?? "—"}</p>
                  <Badge tone="ink">{USER_ROLE_LABELS[u.role]}</Badge>
                </div>
              ))
            )}
            <p className="text-xs text-ink-400">
              Yeni bir giriş hesabı (satış personeli için) ajansınız tarafından tanımlanır.
            </p>
          </CardBody>
        </Card>

        <Card hoverable className="animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Contact className="h-4 w-4 text-ink-400" />
              Görüşen Kişi
            </CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            {/* TEK liste - eskiden "Satış Personeli" (burada) ve "Görüşen
                Kişi" (lead detayinda) ayni seyi iki farkli isimle
                sunuyordu, kullanici bir ismi ekleyip diger tarafta
                "gözükmüyor" sanip kafasi karisti. Artik tek kavram, ve
                firma sahibinin kendisi de OTOMATIK burada (bkz.
                lib/data/salespeople.ts::ensureOwnerSalesperson) - elle
                eklenmesine gerek yok, silinemez (spec: "Görüşen kişi
                kısmına buraya eklenen her kişi Firma Sahibi dahil olmak
                üzere eklensin, hepsi bir yerde"). Giris hesabi OLUSTURMAZ. */}
            <p className="text-xs text-ink-600">
              Buraya eklediğiniz isimler, bir lead ile kimin görüştüğünü işaretlerken seçilebilir olur — giriş hesabı oluşturmaz.
            </p>
            {salespeople.map((sp) => (
              <div key={sp.id} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-500/20 text-xs font-semibold text-accent-100">
                  {getInitials(sp.full_name)}
                </span>
                <p className="flex-1 truncate text-sm font-medium text-ink-900">{sp.full_name}</p>
                {sp.is_owner ? (
                  <Badge tone="brand">Firma Sahibi</Badge>
                ) : canEdit ? (
                  <RemoveSalespersonButton salespersonId={sp.id} name={sp.full_name} />
                ) : null}
              </div>
            ))}
            {canEdit ? <CreateSalespersonForm /> : null}
          </CardBody>
        </Card>

        <Card hoverable className="animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-ink-400" />
              Satış Ayarları
            </CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-xs font-medium text-ink-600">
                Ürün Kategorileri {!canEdit ? "" : "— lead formunda gösterilecek liste"}
              </p>
              {categories.length === 0 ? (
                <p className="text-sm text-ink-600">Henüz kategori yok.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => (
                    <Badge key={cat.id} tone="ink" className="gap-1.5">
                      {cat.label}
                      {canEdit ? <RemoveCategoryButton categoryId={cat.id} label={cat.label} /> : null}
                    </Badge>
                  ))}
                </div>
              )}
              {canEdit ? (
                <div className="mt-2.5">
                  <CreateCategoryForm />
                </div>
              ) : null}
            </div>

            <SettingsField label="Gecikme uyarı süresi" value="48 saat" />
          </CardBody>
        </Card>

        <Card hoverable className="animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-ink-400" />
              Bildirimler
            </CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-2.5">
            <NotificationRow
              label="Takip hatırlatmaları"
              description="Takip tarihi gelen/geçen leadler, üstteki zil ikonunda anlık listelenir."
              active
            />
            <NotificationRow
              label="Geciken lead uyarıları"
              description="48 saattir görüşülmeyen leadler 'Gecikenler' sayfasında listelenir."
              active
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
