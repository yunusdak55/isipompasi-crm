import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getLeadById } from "@/lib/data/leads";
import { LeadForm } from "@/components/leads/lead-form";
import { getProductCategories } from "@/lib/data/product-categories";
import { updateLeadAction } from "../../actions";

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLeadById(id);

  if (!lead) {
    notFound();
  }

  const categories = lead.company_id ? await getProductCategories(lead.company_id) : [];
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
          {lead.first_name} {lead.last_name ?? ""}
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <LeadForm action={boundAction} defaultValues={lead} submitLabel="Kaydet" categories={categories} />
      </div>
    </div>
  );
}
