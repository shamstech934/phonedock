import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-[#f0f4fa] to-white">
      <div className="text-center max-w-md">
        <div className="text-8xl font-extrabold text-blue-500/20 mb-4 font-display">404</div>
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Page Not Found</h1>
        <p className="text-sm text-muted-foreground mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Try searching for a phone or browse our categories below.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shadow-blue-500/25"
          >
            Go Home
          </Link>
          <Link
            href="/phones"
            className="px-5 py-2.5 border border-gray-200 hover:border-blue-300 text-gray-700 hover:text-blue-600 text-sm font-semibold rounded-xl transition-colors"
          >
            Browse Phones
          </Link>
        </div>
      </div>
    </div>
  );
}