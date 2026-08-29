"use client";

import { useActionState } from "react";
import { Bot, Check } from "lucide-react";
import { updateAgentNoteAction, type AgentNoteState } from "@/app/(dashboard)/leads/actions";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSaveFeedback } from "@/lib/hooks/use-save-feedback";
import { cn } from "@/lib/utils";

const initialState: AgentNoteState = { error: null };

/**
 * Lead detay sayfasinda DOGRUDAN gorunen, tek-alanli "Ajan Görüşü" paneli
 * (spec: "AI görüşü kısmı direkt gözüksün, düzenlemeye basmadan görmeyelim -
 * hem ajanın doldurabileceği hem benim zorlanmadan yapabileceğim bir yer
 * olsun"). Önceden "Lead'i Düzenle" formunun içindeydi, görmek için tam
 * düzenleme formuna girmek gerekiyordu - artik tek basina, her zaman acik
 * bir metin kutusu: hem WhatsApp ajani (ayni `notes` kolonuna yazar) hem
 * kullanici tek tikla guncelleyebilir.
 */
export function AgentNotePanel({ leadId, notes }: { leadId: string; notes: string | null }) {
  const boundAction = updateAgentNoteAction.bind(null, leadId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const justSaved = useSaveFeedback(isPending, state.error);

  return (
    <Card hoverable className="animate-slide-up border-brand-500/25 bg-gradient-to-br from-brand-500/[0.1] to-transparent">
      <CardBody className="px-5 py-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="agent-badge-ring relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-elevated">
            <Bot className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <p className="text-sm font-bold text-ink-900">Ajan Görüşü</p>
            <p className="text-xs text-ink-600">Görüşmenin özeti ve değerlendirmesi</p>
          </div>
        </div>

        <form action={formAction} className="flex flex-col gap-2.5">
          <textarea
            name="notes"
            rows={4}
            defaultValue={notes ?? ""}
            placeholder="Ajan görüşmeyi tamamlayınca buraya özet düşer — siz de doğrudan buradan düzenleyebilirsiniz."
            className="w-full resize-y rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition-colors duration-150 focus-visible:border-brand-400 focus-visible:bg-white/[0.03]"
          />
          {state.error ? (
            <p role="alert" className="text-xs text-[#ffb4a3]">
              {state.error}
            </p>
          ) : null}
          <div>
            <Button
              type="submit"
              variant="secondary"
              disabled={isPending}
              className={cn(justSaved && "border-success-500/40 bg-success-500/20 text-[#8ef0b8] hover:bg-success-500/20")}
            >
              {isPending ? (
                "Kaydediliyor…"
              ) : justSaved ? (
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  Kaydedildi
                </span>
              ) : (
                "Kaydet"
              )}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
