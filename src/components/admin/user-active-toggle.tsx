"use client";

import { useState, useTransition } from "react";
import { toggleUserActiveAction } from "@/app/(dashboard)/admin/actions";
import { cn } from "@/lib/utils";

/** Kullanicilar listesinde satir ici aktif/pasif anahtari. */
export function UserActiveToggle({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await toggleUserActiveAction(userId, !isActive, { error: null });
            if (result.error) setError(result.error);
          });
        }}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 disabled:opacity-60",
          isActive ? "bg-success-500/70" : "bg-white/15"
        )}
        aria-label={isActive ? "Kullanıcıyı pasifleştir" : "Kullanıcıyı aktifleştir"}
        title={isActive ? "Aktif - pasifleştirmek için tıkla" : "Pasif - aktifleştirmek için tıkla"}
      >
        <span
          className={cn(
            "absolute h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150",
            isActive ? "translate-x-[18px]" : "translate-x-0.5"
          )}
        />
      </button>
      {error ? <span className="text-[10px] text-[#ffb4a3]">{error}</span> : null}
    </div>
  );
}
