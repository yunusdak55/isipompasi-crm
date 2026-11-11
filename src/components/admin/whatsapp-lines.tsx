"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { MessageCircle, Plus, Trash2 } from "lucide-react";
import {
  addWhatsappLineAction,
  deleteWhatsappLineAction,
  updateWhatsappLineAction,
  type WhatsappLineState,
} from "@/app/(dashboard)/admin/actions";
import { cn } from "@/lib/utils";

export type WhatsappLineRow = {
  id: string;
  company_id: string;
  phone_number_id: string;
  display_phone: string | null;
  bot_enabled: boolean;
  require_ad_referral: boolean;
  test_mode: boolean;
  bot_info: string | null;
};

type Flag = "bot_enabled" | "require_ad_referral" | "test_mode";

const FLAGS: { key: Flag; label: string; hint: string }[] = [
  { key: "bot_enabled", label: "Bot açık", hint: "Kapalıysa bot bu hatta hiç cevap vermez." },
  { key: "require_ad_referral", label: "Yalnız reklamdan gelenler", hint: "Açıksa bot sadece Meta reklamından gelen yeni sohbetlere girer." },
  { key: "test_mode", label: "Test modu", hint: "Açıksa cevaplar kaydedilir ama WhatsApp'a gönderilmez." },
];

function FlagToggle({ line, flag }: { line: WhatsappLineRow; flag: (typeof FLAGS)[number] }) {
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(line[flag.key]);
  const [error, setError] = useState<string | null>(null);

  return (
    <label title={flag.hint} className={cn("flex cursor-pointer items-center gap-2 text-xs", isPending && "opacity-60")}>
      <input
        type="checkbox"
        checked={value}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.checked;
          setValue(next);
          setError(null);
          startTransition(async () => {
            const res = await updateWhatsappLineAction(line.id, { [flag.key]: next });
            if (res.error) {
              setValue(!next);
              setError(res.error);
            }
          });
        }}
        className="h-4 w-4 accent-[var(--accent,#f47c20)]"
      />
      <span className="text-ink-700">{flag.label}</span>
      {error ? <span className="text-[10px] text-[#ffb4a3]">{error}</span> : null}
    </label>
  );
}

function BotInfo({ line }: { line: WhatsappLineRow }) {
  const [value, setValue] = useState(line.bot_info ?? "");
  const [saved, setSaved] = useState(line.bot_info ?? "");
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = value.trim() !== saved.trim();

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5 text-xs text-ink-600">
        Botun müşteriye söyleyebileceği firma bilgileri
        <textarea
          value={value}
          maxLength={2000}
          rows={2}
          onChange={(e) => {
            setValue(e.target.value);
            setMsg(null);
          }}
          placeholder='ör. Ödeme: Müşteri ödeme yöntemini sorarsa aynen şunu söyle: "Kredi kartı ile 12 taksite kadar yardımcı olunabiliyor."'
          className="ik-input min-h-[60px] resize-y"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!dirty || isPending}
          onClick={() =>
            startTransition(async () => {
              const res = await updateWhatsappLineAction(line.id, { bot_info: value });
              if (res.error) setMsg(res.error);
              else {
                setSaved(value);
                setMsg("Kaydedildi");
              }
            })
          }
          className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-ink-700 transition-colors hover:text-ink-900 disabled:opacity-40"
        >
          {isPending ? "Kaydediliyor…" : "Kaydet"}
        </button>
        <span className="text-[11px] text-ink-500">
          Bot yalnızca burada yazanları söyler; adres, garanti, fiyat gibi bilgileri uydurmaz.
        </span>
        {msg ? <span className={cn("text-[11px]", msg === "Kaydedildi" ? "text-ink-600" : "text-[#ffb4a3]")}>{msg}</span> : null}
      </div>
    </div>
  );
}

function DeleteLine({ lineId }: { lineId: string }) {
  const [armed, setArmed] = useState(false);
  const [isPending, startTransition] = useTransition();
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!armed) return setArmed(true);
        startTransition(async () => {
          await deleteWhatsappLineAction(lineId);
        });
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors",
        armed ? "border-danger-500/40 bg-danger-500/15 text-danger-500" : "border-white/10 text-ink-600 hover:text-ink-900"
      )}
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      {armed ? "Emin misiniz?" : "Kaldır"}
    </button>
  );
}

const initial: WhatsappLineState = { error: null };

export function WhatsappLines({
  lines,
  companies,
}: {
  lines: WhatsappLineRow[];
  companies: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(addWhatsappLineAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const nameOf = (id: string) => companies.find((c) => c.id === id)?.name ?? "—";

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex flex-col">
      {lines.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
          <MessageCircle className="h-5 w-5 text-ink-400" aria-hidden="true" />
          <p className="text-sm font-medium text-ink-900">Henüz bağlı hat yok</p>
          <p className="text-sm text-ink-600">Müşterinin WhatsApp hattını Meta&apos;da bağladıktan sonra aşağıdan ekleyin.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {lines.map((line) => (
            <li key={line.id} className="flex flex-col gap-3 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-ink-900">{nameOf(line.company_id)}</p>
                <p className="text-xs text-ink-600">
                  {line.display_phone ? `${line.display_phone} · ` : ""}ID {line.phone_number_id}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {FLAGS.map((flag) => (
                  <FlagToggle key={flag.key} line={line} flag={flag} />
                ))}
                <DeleteLine lineId={line.id} />
              </div>
              </div>
              <BotInfo line={line} />
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={formAction} className="flex flex-col gap-3 border-t border-line px-5 py-4 lg:flex-row lg:items-end">
        <label className="flex flex-1 flex-col gap-1.5 text-xs text-ink-600">
          Firma
          <select name="company_id" required defaultValue="" className="ik-input [&>option]:bg-surface [&>option]:text-[#111827]">
            <option value="" disabled>
              Firma seçin
            </option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1.5 text-xs text-ink-600">
          Phone Number ID (Meta)
          <input name="phone_number_id" required inputMode="numeric" placeholder="ör. 123456789012345" className="ik-input" />
        </label>
        <label className="flex flex-1 flex-col gap-1.5 text-xs text-ink-600">
          Numara (görünen)
          <input name="display_phone" placeholder="0532 000 00 00" className="ik-input" />
        </label>
        <button type="submit" disabled={isPending} className="ik-btn-primary inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-sm">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Hattı Ekle
        </button>
      </form>
      {state.error ? <p className="px-5 pb-4 text-xs text-[#ffb4a3]">{state.error}</p> : null}
    </div>
  );
}
