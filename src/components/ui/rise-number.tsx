/**
 * Buyuk sayilar icin giris: rakamlar soldan saga, bulaniktan netlesip yerine
 * oturur. 0'dan SAYMAZ: ekrandaki deger ilk boyamadan itibaren GERCEK degerdir,
 * yalnizca her rakamin gorunurlugu (opacity/transform) canlanir. Boylece hidrasyon
 * gecikse ya da sekme arka planda olsa da hicbir karede yanlis/yarim rakam
 * gorunmez (bkz. animated-number.tsx'teki eski sorun). Sunucu bileseni olarak da
 * calisir (JS gerekmez). Ekran okuyucu tum degeri tek parca okur.
 */
export function RiseNumber({ value, delayMs = 0, className }: { value: string | number; delayMs?: number; className?: string }) {
  const text = typeof value === "number" ? value.toLocaleString("tr-TR") : value;
  return (
    <span className={className} aria-label={text}>
      <span className="num-rise" aria-hidden="true" style={{ "--nd": `${delayMs}ms` } as React.CSSProperties}>
        {Array.from(text).map((ch, i) => (
          <span key={`${i}-${ch}`} style={{ "--d": i } as React.CSSProperties}>
            {ch === " " ? " " : ch}
          </span>
        ))}
      </span>
    </span>
  );
}
