import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { LeadForm } from "@/components/leads/lead-form";
import { getProductCategories } from "@/lib/data/product-categories";
import { createLeadAction } from "../actions";

export default async function NewLeadPage() {
  const profile = await requireProfile();

  if (!profile.company_id) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-sm text-ink-600">
        Hesabınıza bağlı bir firma bulunmuyor, lead oluşturulamıyor.
      </div>
    );
  }

  const categories = await getProductCategories(profile.company_id);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/leads"
        className="group inline-flex w-fit items-center gap-1.5 text-sm text-ink-600 transition-colors duration-150 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-150 ease-snappy group-hover:-translate-x-0.5" />
        Leadlere dön
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-ink-900">Yeni Lead</h1>
        <p className="text-sm text-ink-600">Yeni bir potansiyel müşteri kaydı oluşturun.</p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <LeadForm action={createLeadAction} submitLabel="Lead Oluştur" categories={categories} />
      </div>
    </div>
  );
}
