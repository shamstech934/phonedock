'use client';
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <h2 className="text-xl font-semibold text-red-500">Something went wrong!</h2>
          <button onClick={reset} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">Try again</button>
        </div>
      </body>
    </html>
  );
}