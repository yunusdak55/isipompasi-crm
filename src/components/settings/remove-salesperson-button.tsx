"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteSalespersonAction } from "@/app/(dashboard)/settings/actions";

/** İsim bazlı satış personeli kaydını kaldırır - giriş hesabı değil, sadece bir isim etiketi (geri alınamaz). */
export function RemoveSalespersonButton({ salespersonId, name }: { salespersonId: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {error ? <span className="text-xs text-[#ffb4a3]">{error}</span> : null}
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(`${name} adlı satış personeli kaydını kalıcı olarak kaldırmak istediğinize emin misiniz?`)) return;
          setError(null);
          startTransition(async () => {
            const result = await deleteSalespersonAction(salespersonId, { error: null });
            if (result.error) setError(result.error);
          });
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 transition-colors duration-150 hover:bg-danger-500/10 hover:text-danger-500 disabled:opacity-50"
        aria-label={`${name} adlı personeli kaldır`}
        title="Kaydı kalıcı olarak kaldır"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
