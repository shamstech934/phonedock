export default function SearchLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="skeleton-shimmer h-10 w-64 rounded-xl mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}