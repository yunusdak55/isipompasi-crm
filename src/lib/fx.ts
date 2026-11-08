/**
 * Gorsel efekt duzeyi: zayif cihazda panel akici kalsin diye pahali efektler
 * kendiliginden hafifler (Merihe panelindeki perf.js'in aynisi).
 *
 * Neden on yuzde: animasyonu ve bulanikligi her zaman kullanicinin bilgisayari
 * cizer. Pahali iki sey olculup gerektiginde kisilir:
 *  - canli cam bulanikligi (backdrop-filter): her karede arkadaki pikselleri yeniden bulaniklastirir
 *  - surekli hareket eden buyuk katmanlar + sayfa gecisindeki bulaniklik
 * Hafif modda bunlarin yerine ayni tonda dolu yuzey kalir; gorunum neredeyse ayni.
 *
 * Karar: kullanici secimi (Otomatik / Tam / Hafif) -> otomatikte cihaz bilgisi +
 * ilk saniyelerde kare hizi olcumu. Secim bir cerezde durur ki sunucu ilk
 * boyamada dogru sinifi (<html class="fx-lite">) basabilsin.
 */
export type FxPref = "auto" | "full" | "lite";
export const FX_COOKIE = "ik_fx";

export function parseFxPref(value: string | undefined | null): FxPref {
  return value === "full" || value === "lite" ? value : "auto";
}

function root() {
  return document.documentElement;
}

export function fxPref(): FxPref {
  const match = document.cookie.match(/(?:^|;\s*)ik_fx=([^;]+)/);
  return parseFxPref(match?.[1]);
}

export const fxIsLite = () => root().classList.contains("fx-lite");

function apply(lite: boolean) {
  root().classList.toggle("fx-lite", lite);
}

/** Donanim ipucu: <=2 cekirdek ya da <=2 GB bellek -> bastan hafif. */
function guessFromDevice() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency || 8;
  const mem = nav.deviceMemory || 8;
  return cores <= 2 || mem <= 2;
}

let probing = false;
/**
 * Gorunur sekmede ~2.5 sn kare surelerini olcer; ortanca > 28 ms (~35 fps alti)
 * ise hafif moda gecer (Merihe perf.js kurali). Olcum, acilis koreografisi
 * (gorsel cozme, font, bulaniktan netlesme) BITTIKTEN sonra baslar ve tek tek
 * takilmalara (p90) bakmaz: eskiden acilistaki birkac agir kare yuzunden
 * giris sahnesi ~2 sn sonra kendini "Hafif"e alip tum hareketi durduruyordu.
 */
export function probe() {
  if (probing || fxPref() !== "auto" || fxIsLite()) return;
  if (document.visibilityState !== "visible") {
    document.addEventListener("visibilitychange", probe, { once: true });
    return;
  }
  probing = true;
  window.setTimeout(measure, 3200);
}

function measure() {
  if (fxPref() !== "auto" || fxIsLite()) {
    probing = false;
    return;
  }
  // Arka planda / odakta olmayan pencere (gizli onizleme paneli, baska uygulama)
  // kareleri kendisi yavaslatir: o olcum cihazi degil pencereyi olcer, yapilmaz.
  if (document.visibilityState !== "visible" || !document.hasFocus()) {
    probing = false;
    const retry = () => probe();
    if (document.visibilityState !== "visible") document.addEventListener("visibilitychange", retry, { once: true });
    else window.addEventListener("focus", retry, { once: true });
    return;
  }
  const times: number[] = [];
  let last = 0;
  const t0 = performance.now();
  const step = (t: number) => {
    if (document.visibilityState !== "visible" || !document.hasFocus()) {
      probing = false; // arka plana gecti / odak gitti: olcum gecersiz
      return;
    }
    if (last) times.push(t - last);
    last = t;
    if (t - t0 < 2500) {
      requestAnimationFrame(step);
      return;
    }
    probing = false;
    times.sort((a, b) => a - b);
    const med = times[Math.floor(times.length / 2)] ?? 16;
    if (med > 28) apply(true);
  };
  requestAnimationFrame(step);
}

export function setFxPref(value: FxPref) {
  const maxAge = value === "auto" ? 0 : 60 * 60 * 24 * 365;
  document.cookie = `${FX_COOKIE}=${value}; path=/; max-age=${maxAge}; samesite=lax`;
  apply(value === "lite" || (value === "auto" && guessFromDevice()));
  if (value === "auto") probe();
  window.dispatchEvent(new Event("ik-fx-change"));
}

/** Sayfa acilisinda bir kez: secimi uygula, sekme gorunurlugunu izle, gerekirse olc. */
export function initFx() {
  const pref = fxPref();
  apply(pref === "lite" || (pref === "auto" && guessFromDevice()));
  const setHidden = () => root().classList.toggle("is-hidden-tab", document.visibilityState !== "visible");
  document.addEventListener("visibilitychange", setHidden);
  setHidden();
  if (pref === "auto") probe();
  return () => document.removeEventListener("visibilitychange", setHidden);
}

export function reduceMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Kazanc ani (satis kaydedildi): ekranin ortasindan kisa bir isi dalgasi + yukari
 * suzulen sicak kivilcimlar (0,9-1,1 sn). Isi yukselir: kivilcimlar dagilmaz,
 * yukari suzulur. Hareketi azalt aciksa ya da hafif modda hicbir sey yapmaz.
 */
export function celebrateHeat(x = window.innerWidth / 2, y = window.innerHeight * 0.42) {
  if (reduceMotion() || fxIsLite()) return;
  const box = document.createElement("div");
  box.className = "heat-burst";
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
  const colors = ["#fff1dc", "#ffc27a", "#ffb454", "#f47c20", "#8fd3ff"];
  for (let i = 0; i < 30; i++) {
    const spread = (Math.random() - 0.5) * 2; // -1..1
    const ember = document.createElement("i");
    ember.style.setProperty("--dx", `${Math.round(spread * 150 + (Math.random() - 0.5) * 30)}px`);
    ember.style.setProperty("--dy", `${Math.round(-60 - Math.random() * 170 + Math.abs(spread) * 40)}px`);
    ember.style.setProperty("--s", `${(3 + Math.random() * 5).toFixed(1)}px`);
    ember.style.setProperty("--c", colors[i % colors.length]);
    ember.style.setProperty("--dl", `${(Math.random() * 0.12).toFixed(2)}s`);
    box.appendChild(ember);
  }
  const ring = document.createElement("div");
  ring.className = "heat-ring";
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  document.body.append(ring, box);
  window.setTimeout(() => {
    box.remove();
    ring.remove();
  }, 1400);
}
