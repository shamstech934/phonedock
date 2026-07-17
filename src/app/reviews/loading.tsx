export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="skeleton-shimmer h-8 w-48 rounded-lg mb-6" />
      <div className="skeleton-shimmer h-11 w-full max-w-md rounded-xl mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array(6).fill(0).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-4 space-y-3">
            <div className="flex items-start gap-4">
              <div className="skeleton-shimmer h-24 w-24 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton-shimmer h-5 w-3/4 rounded" />
                <div className="skeleton-shimmer h-4 w-1/2 rounded" />
                <div className="skeleton-shimmer h-3 w-full rounded" />
                <div className="skeleton-shimmer h-3 w-5/6 rounded" />
                <div className="flex gap-1 pt-1">
                  {[...Array(5)].map((_, j) => (
                    <div key={j} className="skeleton-shimmer h-4 w-4 rounded" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}