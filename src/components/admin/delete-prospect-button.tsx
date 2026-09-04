"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteProspectAction } from "@/app/(dashboard)/admin/prospects/actions";

export function DeleteProspectButton({ prospectId, companyName }: { prospectId: string; companyName: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(`${companyName} adayını kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) return;
          setError(null);
          startTransition(async () => {
            const result = await deleteProspectAction(prospectId, { error: null });
            if (result.error) setError(result.error);
          });
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 transition-colors duration-150 hover:bg-danger-500/10 hover:text-danger-500 disabled:opacity-50"
        aria-label={`${companyName} adayını sil`}
        title="Kalıcı olarak sil"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {error ? <span className="text-[10px] text-[#ffb4a3]">{error}</span> : null}
    </div>
  );
}
