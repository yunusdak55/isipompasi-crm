"use client";

import { useEffect, useState } from "react";
import { fxPref, initFx, setFxPref, type FxPref } from "@/lib/fx";

/** Kok layout'ta bir kez: efekt duzeyini uygular, sekme gorunurlugunu izler. Gorunur bir sey cizmez. */
export function FxController() {
  useEffect(() => initFx(), []);
  return null;
}

const OPTIONS: { value: FxPref; label: string; hint: string }[] = [
  { value: "auto", label: "Otomatik", hint: "Cihaz yavaşsa efektler kendiliğinden hafifler" },
  { value: "full", label: "Tam", hint: "Tüm cam ve hareket efektleri açık" },
  { value: "lite", label: "Hafif", hint: "Canlı bulanıklık ve sürekli hareket kapalı" },
];

/** Menunun altindaki kucuk "Görsel efektler" secicisi. */
export function FxSwitch({ className }: { className?: string }) {
  const [pref, setPref] = useState<FxPref>("auto");
  useEffect(() => {
    const sync = () => setPref(fxPref());
    sync();
    window.addEventListener("ik-fx-change", sync);
    return () => window.removeEventListener("ik-fx-change", sync);
  }, []);

  return (
    <div className={className}>
      <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-4)]">Görsel efektler</p>
      <div className="ik-fx" role="group" aria-label="Görsel efekt düzeyi">
        {OPTIONS.map((o) => (
          <button key={o.value} type="button" title={o.hint} aria-pressed={pref === o.value} onClick={() => setFxPref(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
