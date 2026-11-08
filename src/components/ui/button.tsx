import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";

// Marka kimligi: primary = "alev" gradyanli turuncu CTA (duz tek renk yerine
// sicak-ust/kor-alt gecisi - daha az "duz sticker", daha sicak/dolgun) +
// keskin degil YAYGIN/yumusak bir ambient glow (spec: "cok net olmasin,
// hafif blur ile seyrelt" - metni bulaniklastirmadan, golgeyi yayarak).
// secondary = lacivert outline, ghost = notr.
const variantClasses: Record<Variant, string> = {
  // Tasarim yukseltmesi: ust kenarda ic isik cizgisi (cam/metal hissi), hover'da yalnizca
  // yukselme + parlaklik (arka plan konumu animasyonu KALDIRILDI - her karede boyama demekti).
  // primary: marka turuncusu degrade + ustte ic isik; uzerine gelince 1 px yukselir ve
  // uzerinden bir kez isik gecer (app/iklim.css .ik-btn-primary).
  primary: "ik-btn-primary",
  secondary: "ik-btn-ghost",
  ghost: "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
};

// Motion: MICRO katman (globals.css) - hover/press hizli ve kesin hissettirmeli,
// disabled durumunda animasyon devre disi (spec md.5: "loading/disabled duzgun").
const baseClasses =
  "relative inline-flex items-center justify-center gap-2 rounded-[10px] px-3.5 py-2 text-sm font-medium transition-[transform,filter,box-shadow,background-color,border-color,color] duration-150 ease-snappy active:scale-[0.97] active:duration-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100";

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={cn(baseClasses, variantClasses[variant], className)} {...props} />;
}

export function LinkButton({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={cn(baseClasses, variantClasses[variant], className)}>
      {children}
    </Link>
  );
}
