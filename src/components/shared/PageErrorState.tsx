'use client';

import Link from 'next/link';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface PageErrorStateProps {
  error?: Error & { digest?: string };
  reset: () => void;
  title?: string;
}

export function PageErrorState({ error, reset, title = 'We could not load this page' }: PageErrorStateProps) {
  return (
    <main className="flex min-h-[65vh] items-center justify-center px-4 py-12">
      <section className="card-premium w-full max-w-lg p-6 text-center sm:p-10" role="alert">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-200/70">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
          A temporary problem occurred. Try again, or return to the homepage and continue browsing phones.
        </p>
        {process.env.NODE_ENV === 'development' && error?.message && (
          <p className="mt-3 rounded-xl bg-slate-950/5 px-3 py-2 text-left text-xs text-slate-500">{error.message}</p>
        )}
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 text-sm font-bold text-white shadow-sm shadow-sky-500/25 transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-5 text-sm font-bold text-slate-700 transition hover:border-sky-200 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            <Home className="h-4 w-4" aria-hidden="true" /> Go home
          </Link>
        </div>
      </section>
    </main>
  );
}
