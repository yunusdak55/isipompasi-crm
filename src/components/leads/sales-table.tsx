import Link from "next/link";
import { Phone } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { SaleListItem } from "@/lib/data/sales";

/** Satışlar sayfasında kime ne satıldığını gösteren liste (spec: "adam kime ne sattığını görsün") - diğer lead tablolarıyla aynı görünüm dili. */
export function SalesTable({ sales }: { sales: SaleListItem[] }) {
  if (sales.length === 0) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] py-16 text-center">
        <p className="text-sm font-medium text-white">Henüz gerçekleşmiş satış yok</p>
        <p className="text-sm text-white/50">Bir lead &quot;Satış&quot; durumuna taşındığında burada listelenir.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-white/10 bg-white/[0.03] text-xs font-medium uppercase tracking-wide text-white/45">
          <tr>
            <th className="px-4 py-3 font-medium">Müşteri</th>
            <th className="px-4 py-3 font-medium">Şehir</th>
            <th className="px-4 py-3 font-medium">Ürün</th>
            <th className="px-4 py-3 font-medium">Tutar</th>
            <th className="px-4 py-3 font-medium">Tarih</th>
            <th className="px-4 py-3 font-medium">Satış Personeli</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {sales.map((sale, index) => (
            <tr
              key={sale.id}
              className="group animate-slide-up transition-all duration-150 ease-snappy hover:bg-white/[0.05] hover:shadow-[inset_2px_0_0_0_var(--color-success-500)]"
              style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
            >
              <td className="px-4 py-3.5">
                {sale.lead ? (
                  <>
                    <Link
                      href={`/leads/${sale.lead.id}`}
                      className="font-medium text-white transition-colors group-hover:text-accent-300"
                    >
                      {sale.lead.firstName} {sale.lead.lastName ?? ""}
                    </Link>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-white/60">
                      <Phone className="h-3 w-3 shrink-0 text-white/40" strokeWidth={2} />
                      {sale.lead.phone}
                    </p>
                  </>
                ) : (
                  <span className="text-white/40">Lead silinmiş</span>
                )}
              </td>
              <td className="px-4 py-3.5 text-white/70">{sale.lead?.city ?? "—"}</td>
              <td className="px-4 py-3.5 text-white/70">{sale.lead?.productLabel ?? "—"}</td>
              <td className="px-4 py-3.5 font-semibold tabular-nums text-success-300">{formatCurrency(sale.saleAmount)}</td>
              <td className="px-4 py-3.5 text-white/70">{formatDate(sale.saleDate)}</td>
              <td className="px-4 py-3.5 text-white/70">{sale.salespersonName ?? "Atanmamış"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
