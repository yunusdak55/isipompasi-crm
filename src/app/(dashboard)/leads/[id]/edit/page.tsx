import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getClaimsCompanyHint, requireProfile } from "@/lib/auth/session";
import { getLeadById } from "@/lib/data/leads";
import { LeadForm } from "@/components/leads/lead-form";
import { getProductCategories } from "@/lib/data/product-categories";
import { leadDisplayName } from "@/lib/utils";
import { updateLeadAction } from "../../actions";

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  // DUZELTME (denetim bulgusu, bkz. dashboard/page.tsx ayni aciklama).
  //
  // PERF (olcum 2026-10-05): profil -> lead -> kategoriler ART ARDA (3 ag turu)
  // bekleniyordu. Ucu de ayni turda baslar; kategoriler JWT'deki firma ipucuyla
  // istenir (bkz. getClaimsCompanyHint) ve lead'in firmasiyla uyusmuyorsa
  // dogru firmayla yeniden cekilir.
  const { id } = await params;
  const companyHint = await getClaimsCompanyHint();
  const [profile, lead, hintedCategories] = await Promise.all([
    requireProfile(),
    getLeadById(id),
    companyHint ? getProductCategories(companyHint) : Promise.resolve(null),
  ]);
  if (profile.role === "admin") {
    redirect("/admin/companies");
  }

  if (!lead) {
    notFound();
  }

  const categories = !lead.company_id
    ? []
    : hintedCategories && companyHint === lead.company_id
      ? hintedCategories
      : await getProductCategories(lead.company_id);
  const boundAction = updateLeadAction.bind(null, id);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={`/leads/${id}`}
        className="group inline-flex w-fit items-center gap-1.5 text-sm text-ink-600 transition-colors duration-150 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-150 ease-snappy group-hover:-translate-x-0.5" />
        Lead detayına dön
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-ink-900">Lead Düzenle</h1>
        <p className="text-sm text-ink-600">
          {leadDisplayName(lead)}
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <LeadForm action={boundAction} defaultValues={lead} submitLabel="Kaydet" categories={categories} />
      </div>
    </div>
  );
}
