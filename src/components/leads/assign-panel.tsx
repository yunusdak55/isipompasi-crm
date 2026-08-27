"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { assignSalespersonAction, type AssignActionState } from "@/app/(dashboard)/leads/actions";
import { Button } from "@/components/ui/button";
import { useSaveFeedback } from "@/lib/hooks/use-save-feedback";
import { cn } from "@/lib/utils";

const selectClass =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-900 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.03] [&>option]:text-[#111827]";

const initialState: AssignActionState = { error: null };

/** Item 8: sadece owner/admin gorur (sales icin RLS zaten baskasina atamayi engeller). */
export function AssignPanel({
  leadId,
  currentAssigned,
  assignableProfiles,
}: {
  leadId: string;
  currentAssigned: string | null;
  assignableProfiles: { id: string; full_name: string | null }[];
}) {
  const boundAction = assignSalespersonAction.bind(null, leadId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const justSaved = useSaveFeedback(isPending, state.error);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <select name="assigned_salesperson" defaultValue={currentAssigned ?? ""} className={selectClass}>
        <option value="">Atanmadı</option>
        {assignableProfiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.full_name ?? p.id}
          </option>
        ))}
      </select>
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
            "Ata"
          )}
        </Button>
      </div>
    </form>
  );
}
