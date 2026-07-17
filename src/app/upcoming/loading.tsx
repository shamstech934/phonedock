export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="skeleton-shimmer h-8 w-48 rounded-lg mb-6" />
      <p className="skeleton-shimmer h-5 w-72 rounded mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array(8).fill(0).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-3 space-y-3">
            <div className="skeleton-shimmer h-32 w-full rounded-xl" />
            <div className="skeleton-shimmer h-4 w-3/4 rounded" />
            <div className="skeleton-shimmer h-3 w-1/2 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}