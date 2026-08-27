"use client";

import { useEffect, useRef, useState } from "react";

type ParsedValue = { prefix: string; suffix: string; target: number; decimals: number; grouped: boolean };

/**
 * Formatlanmis bir metin degerini (or. "₺315.000", "%12.5", "6") sayisal
 * kismina ayristirir. Ayristirilamayan degerler (or. "—") statik kalir.
 * "%" prefix/suffix'i JS-stili ondalik (nokta = ondalik) olarak, digerleri
 * TR-stili binlik gruplama (nokta = binlik ayirici, ondalik yok) olarak
 * yorumlanir - bu proje bu iki formati bu sekilde kullaniyor.
 */
function parseValue(raw: string): ParsedValue | null {
  const match = raw.match(/^([^\d-]*)(-?[\d.,]+)([^\d]*)$/);
  if (!match) return null;
  const [, prefix, numPart, suffix] = match;
  const isPercent = prefix.includes("%") || suffix.includes("%");

  if (isPercent) {
    const dotIndex = numPart.indexOf(".");
    const decimals = dotIndex === -1 ? 0 : numPart.length - dotIndex - 1;
    const target = Number(numPart);
    if (!Number.isFinite(target)) return null;
    return { prefix, suffix, target, decimals, grouped: false };
  }

  const target = Number(numPart.replace(/\./g, ""));
  if (!Number.isFinite(target)) return null;
  return { prefix, suffix, target, decimals: 0, grouped: true };
}

/** Kart degerleri icin premium "count-up" animasyonu - sayi 0'dan hedefe kisa bir egriyle yukselir. */
export function AnimatedStatValue({ value }: { value: string | number }) {
  const raw = String(value);
  const parsed: ParsedValue | null =
    typeof value === "number" ? { prefix: "", suffix: "", target: value, decimals: 0, grouped: false } : parseValue(raw);

  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!parsed) return;
    const target = parsed.target;
    let start: number | null = null;
    const duration = 700;

    function tick(ts: number) {
      if (start === null) start = ts;
      const progress = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(target * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    // Guvenlik agi: gercek para/is verisi gosteriyoruz - RAF herhangi bir
    // sebeple (arka plan sekme, tarayici kisitlamasi vb.) hic calismazsa
    // deger sonsuza dek 0'da asili kalmasin diye sure sonunda kesin deger
    // zorlanir. RAF normal calisirsa bu zaten ayni degeri tekrar yazar.
    const fallback = setTimeout(() => setDisplay(target), duration + 50);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      clearTimeout(fallback);
    };
    // parsed.target degisince yeniden oynatilir; digerleri ayni deger icin sabit kalir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed?.target]);

  if (!parsed) return <>{raw}</>;

  const formatted = parsed.grouped ? Math.round(display).toLocaleString("tr-TR") : display.toFixed(parsed.decimals);

  return (
    <>
      {parsed.prefix}
      {formatted}
      {parsed.suffix}
    </>
  );
}
