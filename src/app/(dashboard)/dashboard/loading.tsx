export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-900 to-brand-950 shadow-elevated-lg ring-1 ring-inset ring-white/10">
        <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-9">
          <div className="flex flex-col">
            <div className="skeleton h-3 w-44 rounded bg-white/10" />
            <div className="skeleton mt-4 h-10 w-72 max-w-full rounded-lg bg-white/10" />
            <div className="skeleton mt-4 h-4 w-96 max-w-full rounded-lg bg-white/10" />
            <div className="mt-8 grid grid-cols-3 gap-2.5 sm:gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <div className="flex items-start justify-between">
                    <div className="skeleton h-3 w-14 rounded bg-white/10" />
                    <div className="skeleton h-8 w-8 rounded-xl bg-white/10" />
                  </div>
                  <div className="skeleton mt-4 h-10 w-14 rounded bg-white/10" />
                  <div className="skeleton mt-3 h-3 w-20 rounded bg-white/10" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="skeleton h-3 w-32 rounded bg-white/10" />
            <div className="skeleton mt-3 h-6 w-24 rounded bg-white/10" />
            <div className="mt-6 flex h-32 items-end gap-3">
              {[40, 70, 55, 90, 35, 60, 45].map((h, i) => (
                <div key={i} className="skeleton flex-1 rounded-t-xl bg-white/10" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {[
          [5, 3],
          [3, 4],
        ].map((rowCounts, col) => (
          <div key={col} className="flex flex-col gap-6">
            {rowCounts.map((rows, card) => (
              <div key={card} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
                  <div className="skeleton h-9 w-9 rounded-xl" />
                  <div className="skeleton h-4 w-32 rounded" />
                </div>
                <div className="divide-y divide-white/[0.05]">
                  {Array.from({ length: rows }).map((__, r) => (
                    <div key={r} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="skeleton h-10 w-10 rounded-full" />
                      <div className="flex-1">
                        <div className="skeleton h-3.5 w-36 rounded" />
                        <div className="skeleton mt-2 h-3 w-48 max-w-full rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
