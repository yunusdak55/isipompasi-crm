/**
 * Giris sahnesi (yeniden, 2026-11-08): bulanik gece evi fotografi + gece
 * mavisi tul, pencerelerden sizan birkac sicak bokeh, ve on planda kameraya
 * cok yakin, bulanik bir isi pompasi dis unitesi (Merihe'deki yapragin HVAC
 * karsiligi): pervanesi doner, ustunden buhar yukselir. Pervane hep ayni hizli tempoda doner.
 * Hepsi transform/opacity ile hareket eder; derinlik (imlec) data-depth ile.
 * Konumlar sabit: sunucu ve tarayici ayni HTML'i uretir.
 */
const BOKEH: { x: number; y: number; s: number; o: number; du: number; de: number }[] = [
  { x: 62, y: 38, s: 120, o: 0.32, du: 26, de: 0 },
  { x: 78, y: 54, s: 80, o: 0.26, du: 22, de: 4 },
  { x: 88, y: 30, s: 150, o: 0.18, du: 30, de: 9 },
  { x: 70, y: 70, s: 60, o: 0.3, du: 20, de: 2 },
  { x: 54, y: 62, s: 44, o: 0.24, du: 24, de: 7 },
];

const STEAM: { x: number; s: number; du: number; de: number }[] = [
  { x: 30, s: 1, du: 9, de: 0 },
  { x: 48, s: 1.3, du: 11, de: 3.2 },
  { x: 64, s: 0.9, du: 10, de: 6.1 },
  { x: 40, s: 1.15, du: 12, de: 8.4 },
];

export function LoginScene() {
  return (
    <div className="scene" aria-hidden="true">
      <div className="ly sc-far" data-depth="0.25">
        <div className="sc-photo" />
      </div>
      <div className="sc-tint" />
      {/* pencereler: giris yapilirken isik artar (ev isiniyor) */}
      <div className="sc-glow" />

      <div className="ly sc-bokeh" data-depth="0.6">
        {BOKEH.map((b, i) => (
          <i
            key={i}
            style={{ "--x": `${b.x}%`, "--y": `${b.y}%`, "--s": `${b.s}px`, "--o": b.o, "--du": `${b.du}s`, "--de": `${b.de}s` } as React.CSSProperties}
          />
        ))}
      </div>
      {/* sag ust: kameraya yakin, bulanik ciplak dal; ruzgarda cok hafif salinir */}
      <div className="ly sc-branch-ly" data-depth="1.3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="sc-branch" src="/img/agac-dali.webp" alt="" width={1100} height={1100} decoding="async" />
      </div>
      <div className="ly sc-near" data-depth="1.6">
        <div className="hp">
          <div className="hp-steam">
            {STEAM.map((s, i) => (
              <i key={i} style={{ "--x": `${s.x}%`, "--k": s.s, "--du": `${s.du}s`, "--de": `${s.de}s` } as React.CSSProperties} />
            ))}
          </div>
          {/* eslint-disable @next/next/no-img-element */}
          <span className="hp-disk" />
          {/* kanatlar: hizli ve sabit doner; donus bulanikligi + altta silik net kanat */}
          <div className="hp-rotor">
            <img className="rs" src="/img/unite-pervane.webp" alt="" width={900} height={900} decoding="async" />
            <img className="rb" src="/img/unite-pervane-hiz.webp" alt="" width={900} height={900} decoding="async" />
          </div>
          <img className="hp-grille" src="/img/unite-izgara.webp" alt="" width={900} height={900} decoding="async" />
          {/* govde en ustte: fan acikligi seffaf, pervane ve izgara icinden gorunur */}
          <img className="hp-body" src="/img/unite-govde.webp" alt="" width={1200} height={800} decoding="async" />
          <span className="hp-puff" />
          {/* eslint-enable @next/next/no-img-element */}
        </div>
      </div>
      <div className="sc-vignette" />
    </div>
  );
}

/**
 * Akiskan logo: harfler bulaniktan netlesir, ardindan harflerin ICINDE cok
 * yavas bir buz-isik akisi dolasir (logo seklinde maskeli genis bir katman
 * yalnizca transform ile kayar). 14 sn'de bir ince parlama gecer.
 */
export function FlowLogo() {
  return (
    <div className="flogo">
      <span className="flogo-glow" aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="İklimlen" className="flogo-img" width={520} height={99} />
      <span className="flogo-flow" aria-hidden="true">
        <i />
      </span>
      <span className="flogo-warm" aria-hidden="true" />
      <span className="flogo-dot" aria-hidden="true" />
      <span className="logo-sheen" aria-hidden="true" />
    </div>
  );
}
