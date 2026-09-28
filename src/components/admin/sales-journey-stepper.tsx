"use client";

import { useEffect, useRef, useState } from "react";
import { PhoneCall, Compass, Target, Lightbulb, ShieldQuestion, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = [
  { id: "hero", label: "Açılış", icon: PhoneCall },
  { id: "kesif", label: "İhtiyaç Analizi", icon: Compass },
  { id: "teshis", label: "Teşhis", icon: Target },
  { id: "cozum", label: "Çözüm", icon: Lightbulb },
  { id: "itiraz", label: "İtiraz", icon: ShieldQuestion },
  { id: "sonraki", label: "Sonraki Adım", icon: Flag },
] as const;

/**
 * Satış yolculuğunu gösteren, YAPIŞKAN (sticky) kokpit şeridi (spec
 * 2026-10-01: "merkezde satış yolculuğunu görsel olarak güçlü biçimde
 * anlat ... aktif aşama belirgin şekilde öne çıksın"). Telefonda konuşurken
 * scroll ne kadar aşağı inerse insin bu şerit ekranda kalır - hangi
 * aşamada olduğun ("İhtiyaç Analizi mi, İtiraz mı") her an bir bakışta
 * belli olur. IntersectionObserver ile o an ekranın ortasına en yakın
 * bölüm otomatik vurgulanır; tıklama da o bölüme kaydırır (native #anchor).
 */
export function SalesJourneyStepper() {
  const [activeId, setActiveId] = useState<string>("hero");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const sections = STAGES.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => el !== null);

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-40% 0px -50% 0px" }
    );

    sections.forEach((el) => observerRef.current?.observe(el));
    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <div className="sticky top-3 z-20 rounded-2xl border border-white/10 bg-brand-900/80 px-4 py-3 shadow-elevated-lg backdrop-blur-md sm:px-5">
      <div className="relative">
        <div
          className="pointer-events-none absolute left-6 right-6 top-[15px] hidden h-px bg-gradient-to-r from-white/5 via-accent-500/35 to-white/5 sm:block"
          aria-hidden
        />
        <div className="relative grid grid-cols-3 gap-y-4 sm:grid-cols-6 sm:gap-y-0">
          {STAGES.map((stage) => {
            const Icon = stage.icon;
            const active = activeId === stage.id;
            return (
              <a
                key={stage.id}
                href={`#${stage.id}`}
                className="flex flex-col items-center gap-1.5 text-center"
              >
                <span
                  className={cn(
                    "flex h-[30px] w-[30px] items-center justify-center rounded-full border transition-all duration-200 ease-premium",
                    active
                      ? "border-accent-500 bg-accent-500 text-white shadow-[0_0_0_4px_rgba(244,124,32,0.18)]"
                      : "border-white/20 bg-brand-900 text-white/50"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className={cn("text-[11px] font-semibold transition-colors duration-200 ease-premium", active ? "text-white" : "text-white/45")}>
                  {stage.label}
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
