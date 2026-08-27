import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";

// Marka kimligi: primary = "alev" gradyanli turuncu CTA (duz tek renk yerine
// sicak-ust/kor-alt gecisi - daha az "duz sticker", daha sicak/dolgun) +
// keskin degil YAYGIN/yumusak bir ambient glow (spec: "cok net olmasin,
// hafif blur ile seyrelt" - metni bulaniklastirmadan, golgeyi yayarak).
// secondary = lacivert outline, ghost = notr.
const variantClasses: Record<Variant, string> = {
  primary:
    "bg-gradient-to-br from-flame-hot via-accent-500 to-flame-ember bg-[length:160%_160%] bg-[position:0%_0%] text-white shadow-glow-accent hover:-translate-y-px hover:bg-[position:100%_100%] hover:shadow-glow-accent-lg",
  secondary: "border border-white/15 bg-white/[0.06] text-white hover:border-white/25 hover:bg-white/[0.12]",
  ghost: "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
};

// Motion: MICRO katman (globals.css) - hover/press hizli ve kesin hissettirmeli,
// disabled durumunda animasyon devre disi (spec md.5: "loading/disabled duzgun").
const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-150 ease-snappy active:scale-[0.97] active:duration-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100";

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
