"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  PROPERTY_TYPE_LABELS,
  BUILDING_STATUS_LABELS,
  HEATING_TYPE_LABELS,
  PURCHASE_TIMELINE_LABELS,
} from "@/lib/constants/lead";
import type { Lead, ProductCategory } from "@/lib/types/domain";

export type LeadFormState = { error: string | null };

const inputClass =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.03] [&>option]:text-[#111827]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink-900">{label}</span>
      {children}
    </label>
  );
}

function combineFullName(defaultValues?: Partial<Lead>): string {
  if (!defaultValues) return "";
  return [defaultValues.first_name, defaultValues.last_name].filter(Boolean).join(" ");
}

function combineLocation(defaultValues?: Partial<Lead>): string {
  if (!defaultValues) return "";
  const { city, district } = defaultValues;
  if (city && district) return `${city} / ${district}`;
  return city ?? district ?? "";
}

export function LeadForm({
  action,
  defaultValues,
  submitLabel,
  categories,
}: {
  action: (prevState: LeadFormState, formData: FormData) => Promise<LeadFormState>;
  defaultValues?: Partial<Lead>;
  submitLabel: string;
  categories: ProductCategory[];
}) {
  const [state, formAction, isPending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ad Soyad *">
          <input
            name="full_name"
            required
            placeholder="Ahmet Yılmaz"
            defaultValue={combineFullName(defaultValues)}
            className={inputClass}
          />
        </Field>
        <Field label="Telefon *">
          <input name="phone" required defaultValue={defaultValues?.phone ?? ""} className={inputClass} />
        </Field>

        <Field label="Şehir / İlçe">
          <input
            name="location"
            placeholder="Sakarya / Sapanca"
            defaultValue={combineLocation(defaultValues)}
            className={inputClass}
          />
        </Field>
        <Field label="Konut Tipi">
          <select name="property_type" defaultValue={defaultValues?.property_type ?? ""} className={inputClass}>
            <option value="">Seçiniz</option>
            {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Alan (m²)">
          <input
            name="area_m2"
            type="number"
            min="0"
            step="0.01"
            defaultValue={defaultValues?.area_m2 ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Bina Durumu">
          <select name="building_status" defaultValue={defaultValues?.building_status ?? ""} className={inputClass}>
            <option value="">Seçiniz</option>
            {Object.entries(BUILDING_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Mevcut Isıtma">
          <select name="heating_type" defaultValue={defaultValues?.heating_type ?? ""} className={inputClass}>
            <option value="">Seçiniz</option>
            {Object.entries(HEATING_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Satın Alma Zamanı">
          <select name="purchase_timeline" defaultValue={defaultValues?.purchase_timeline ?? ""} className={inputClass}>
            <option value="">Seçiniz</option>
            {Object.entries(PURCHASE_TIMELINE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Ürün İlgisi">
          <select name="product_category_id" defaultValue={defaultValues?.product_category_id ?? ""} className={inputClass}>
            <option value="">Seçiniz</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Teklif Tutarı (₺)">
          <input
            name="offered_amount"
            type="number"
            min="0"
            step="1"
            placeholder="ör. 150000"
            defaultValue={defaultValues?.offered_amount ?? ""}
            className={inputClass}
          />
        </Field>
        <div aria-hidden />
      </div>

      <div className="flex gap-6">
        <label className="inline-flex items-center gap-2 text-sm text-ink-900">
          <input
            type="checkbox"
            name="underfloor_heating"
            defaultChecked={defaultValues?.underfloor_heating ?? false}
            className="h-4 w-4 rounded border-line transition-colors duration-150 accent-brand-600"
          />
          Yerden Isıtma Var
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-ink-900">
          <input
            type="checkbox"
            name="radiator"
            defaultChecked={defaultValues?.radiator ?? false}
            className="h-4 w-4 rounded border-line transition-colors duration-150 accent-brand-600"
          />
          Radyatör Var
        </label>
      </div>

      <Field label="Lead Notu">
        <textarea
          name="notes"
          rows={4}
          placeholder="300 m² villa, yeni bina. Yerden ısıtma hazır. Bu ay içinde karar verecek."
          defaultValue={defaultValues?.notes ?? ""}
          className={inputClass}
        />
      </Field>

      {state.error ? (
        <p role="alert" className="rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-[#ffb4a3]">
          {state.error}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Kaydediliyor…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
