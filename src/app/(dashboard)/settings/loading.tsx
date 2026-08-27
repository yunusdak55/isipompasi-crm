export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="skeleton h-6 w-36 rounded-lg" />
        <div className="skeleton mt-2 h-4 w-72 rounded-lg" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-5">
            <div className="skeleton h-4 w-32 rounded" />
            <div className="mt-4 flex flex-col gap-3">
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-2/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
