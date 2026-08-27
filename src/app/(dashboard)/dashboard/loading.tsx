export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-6 shadow-elevated-lg sm:p-7">
        <div className="skeleton h-7 w-40 rounded-lg bg-white/10" />
        <div className="skeleton mt-2 h-4 w-64 rounded-lg bg-white/10" />
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3.5">
              <div className="skeleton h-3 w-20 rounded bg-white/10" />
              <div className="skeleton mt-2 h-5 w-16 rounded bg-white/10" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface px-5 py-4">
            <div className="skeleton h-3 w-16 rounded" />
            <div className="skeleton mt-3 h-7 w-12 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
