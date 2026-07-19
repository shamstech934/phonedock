'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
      <h2 className="text-xl font-semibold text-red-600">Something went wrong</h2>
      <p className="text-sm text-gray-500 text-center max-w-md">{error.message || 'An unexpected error occurred.'}</p>
      <button onClick={reset} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
        Try again
      </button>
    </div>
  );
}
