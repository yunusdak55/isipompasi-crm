export default function LeadDetailLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="skeleton h-4 w-28 rounded" />

      <div className="flex items-start justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
        <div>
          <div className="skeleton h-6 w-40 rounded" />
          <div className="skeleton mt-2 h-4 w-32 rounded" />
        </div>
        <div className="skeleton h-9 w-24 rounded-lg" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-line bg-surface p-5">
              <div className="skeleton h-4 w-36 rounded" />
              <div className="mt-4 grid grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="skeleton h-4 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-line bg-surface p-5">
              <div className="skeleton h-4 w-24 rounded" />
              <div className="skeleton mt-4 h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
