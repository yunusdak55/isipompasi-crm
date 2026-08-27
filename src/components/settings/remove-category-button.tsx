"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { deleteProductCategoryAction } from "@/app/(dashboard)/settings/actions";

/** Urun kategorisini kaldirir - bu kategoriyi kullanan leadler etkilenmez, sadece etiket bosalir. */
export function RemoveCategoryButton({ categoryId, label }: { categoryId: string; label: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-1">
      {error ? <span className="text-[10px] text-[#ffb4a3]">{error}</span> : null}
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await deleteProductCategoryAction(categoryId, { error: null });
            if (result.error) setError(result.error);
          });
        }}
        className="flex h-4 w-4 items-center justify-center rounded-full text-ink-400 transition-colors duration-150 hover:bg-danger-500/15 hover:text-danger-500 disabled:opacity-50"
        aria-label={`${label} kategorisini kaldır`}
        title="Kaldır"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
