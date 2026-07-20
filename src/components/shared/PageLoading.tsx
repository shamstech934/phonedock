import { Skeleton } from '@/components/ui/skeleton';

interface PageLoadingProps {
  cards?: number;
  showHero?: boolean;
}

export function PageLoading({ cards = 8, showHero = true }: PageLoadingProps) {
  return (
    <main className="min-h-[70vh]" aria-busy="true" aria-label="Loading content">
      <div className="container mx-auto px-4 py-8 sm:py-12">
        {showHero && (
          <div className="card-premium mb-8 p-5 sm:p-8">
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="mt-4 h-9 w-full max-w-xl rounded-xl" />
            <Skeleton className="mt-3 h-4 w-full max-w-2xl rounded-lg" />
            <Skeleton className="mt-2 h-4 w-3/4 max-w-xl rounded-lg" />
            <div className="mt-6 flex gap-3">
              <Skeleton className="h-11 w-32 rounded-xl" />
              <Skeleton className="h-11 w-28 rounded-xl" />
            </div>
          </div>
        )}

        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-7 w-44 rounded-lg" />
          </div>
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {Array.from({ length: cards }).map((_, index) => (
            <div key={index} className="phone-card p-3 sm:p-4">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <Skeleton className="mt-4 h-3 w-20 rounded" />
              <Skeleton className="mt-2 h-5 w-4/5 rounded" />
              <Skeleton className="mt-3 h-5 w-24 rounded" />
              <div className="mt-3 flex gap-2">
                <Skeleton className="h-6 w-14 rounded-md" />
                <Skeleton className="h-6 w-16 rounded-md" />
              </div>
              <Skeleton className="mt-4 h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading PhoneDock content…</span>
    </main>
  );
}
