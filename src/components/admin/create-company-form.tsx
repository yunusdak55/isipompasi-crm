"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, X, Check } from "lucide-react";
import { createCompanyWithOwnerAction, type CreateCompanyState } from "@/app/(dashboard)/admin/actions";
import { Button } from "@/components/ui/button";
import { useSaveFeedback } from "@/lib/hooks/use-save-feedback";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/35 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.07] focus-visible:outline-none";

const initialState: CreateCompanyState = { error: null };

/**
 * Firma olusturma + firma sahibi giris hesabi TEK formda (spec: "firma
 * hesabı oluşturma ve kullanıcı oluşturma kısmı farklı, bunu birleştir - ben
 * bir kişi ile anlaştığımda kendi panelime girip firma ismi oluşturayım,
 * giriş bilgileri belirleyeyim, sonra anlaştığım kişi bu bilgilerle girip
 * içeriden kendi satış personeli kısmından oluştursun"). Eskiden bu iki ayri
 * adimda (once firma, sonra ayri "Kullanıcılar" sayfasindan dropdown'dan
 * firma secip kullanici) yapiliyordu.
 */
export function CreateCompanyForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createCompanyWithOwnerAction, initialState);
  const justSaved = useSaveFeedback(isPending, state.error);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (justSaved) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [justSaved]);

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="h-4 w-4" />
        Yeni Firma Ekle
      </Button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="animate-slide-up flex flex-col gap-4 rounded-xl border border-white/12 bg-white/[0.04] p-3.5">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Firma Bilgileri</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/55">Firma Adı *</span>
            <input type="text" name="name" required placeholder="ör. Örnek Isı Sistemleri A.Ş." className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/55">Şehir</span>
            <input type="text" name="city" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/55">İletişim Kişisi</span>
            <input type="text" name="contact_name" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/55">Telefon</span>
            <input type="text" name="contact_phone" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-white/55">Firma İletişim E-postası (bilgi amaçlı)</span>
            <input type="email" name="contact_email" placeholder="info@firma.com" className={fieldClass} />
          </label>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Firma Sahibi Giriş Bilgileri</p>
        <p className="mb-2 text-[11px] text-white/40">
          Bu e-posta/şifre ile firma sahibi doğrudan panele giriş yapar — kendi satış personelini oradan kendisi ekler.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-white/55">Ad Soyad</span>
            <input type="text" name="full_name" placeholder="Boş bırakılırsa firma adı kullanılır" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/55">Giriş E-postası *</span>
            <input type="email" name="email" required placeholder="ornek@firma.com" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/55">Şifre * (en az 8 karakter)</span>
            <input type="text" name="password" required minLength={8} placeholder="Firmaya ileteceğiniz şifre" className={fieldClass} />
          </label>
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="text-xs text-[#ffb4a3]">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          disabled={isPending}
          className={cn(justSaved && "border-success-500/40 bg-success-500/20 text-[#8ef0b8]")}
        >
          {isPending ? (
            "Oluşturuluyor…"
          ) : justSaved ? (
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              Oluşturuldu
            </span>
          ) : (
            "Firmayı ve Giriş Hesabını Oluştur"
          )}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 text-white/60 transition-colors duration-150 hover:bg-white/[0.08] hover:text-white"
          aria-label="İptal"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
