export default function PhoneDetailLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 animate-pulse">
      {/* Breadcrumb */}
      <div className="skeleton-shimmer h-6 w-64 rounded-lg" />

      {/* Main grid: image + content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: image + thumbnails */}
        <div className="space-y-4">
          <div className="skeleton-shimmer aspect-square rounded-2xl" />
          <div className="skeleton-shimmer h-20 rounded-2xl" />
        </div>

        {/* Right: title + price + scores + specs */}
        <div className="lg:col-span-2 space-y-4">
          <div className="skeleton-shimmer h-8 w-3/4 rounded-lg" />
          <div className="skeleton-shimmer h-5 w-48 rounded-lg" />
          <div className="skeleton-shimmer h-36 rounded-2xl" />
          <div className="skeleton-shimmer h-72 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}