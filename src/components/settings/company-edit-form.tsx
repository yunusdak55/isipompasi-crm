"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { updateCompanyAction, type CompanyActionState } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";
import { useSaveFeedback } from "@/lib/hooks/use-save-feedback";
import { cn } from "@/lib/utils";
import type { Company } from "@/lib/types/domain";

const inputClass =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.03]";

const initialState: CompanyActionState = { error: null };

export function CompanyEditForm({ company }: { company: Company }) {
  const boundAction = updateCompanyAction.bind(null, company.id);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const justSaved = useSaveFeedback(isPending, state.error);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <label className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
          <span className="text-xs font-medium text-ink-600">Firma Adı *</span>
          <input name="name" required defaultValue={company.name} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-600">Şehir</span>
          <input name="city" defaultValue={company.city ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-600">İletişim Kişisi</span>
          <input name="contact_name" defaultValue={company.contact_name ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-600">Telefon</span>
          <input name="contact_phone" defaultValue={company.contact_phone ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-600">E-posta</span>
          <input type="email" name="contact_email" defaultValue={company.contact_email ?? ""} className={inputClass} />
        </label>
      </div>

      {state.error ? (
        <p role="alert" className="text-xs text-[#ffb4a3]">
          {state.error}
        </p>
      ) : null}

      <div>
        <Button
          type="submit"
          variant="secondary"
          disabled={isPending}
          className={cn(justSaved && "border-success-500/40 bg-success-500/20 text-[#8ef0b8] hover:bg-success-500/20")}
        >
          {isPending ? (
            "Kaydediliyor…"
          ) : justSaved ? (
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              Kaydedildi
            </span>
          ) : (
            "Kaydet"
          )}
        </Button>
      </div>
    </form>
  );
}
