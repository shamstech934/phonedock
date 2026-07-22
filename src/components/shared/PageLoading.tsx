interface PageLoadingProps {
  cards?: number;
  showHero?: boolean;
}

export function PageLoading(_props: PageLoadingProps) {
  return (
    <main
      className="relative flex min-h-[52vh] items-center justify-center px-4 py-16"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading PhoneDock content"
    >
      <div className="fixed inset-x-0 top-[72px] z-40 h-0.5 overflow-hidden bg-slate-200/70 dark:bg-slate-800/80">
        <span className="phonedock-route-progress block h-full w-1/3 rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-400" />
      </div>

      <div className="flex w-full max-w-sm flex-col items-center rounded-3xl border border-slate-200/80 bg-white/80 px-8 py-9 text-center shadow-xl shadow-slate-900/5 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/80 dark:shadow-black/20">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/25">
          <div className="h-6 w-3.5 rounded-[5px] border-2 border-white" />
          <span className="absolute bottom-4 h-0.5 w-1 rounded-full bg-white" />
          <span className="absolute inset-[-7px] rounded-[22px] border border-blue-400/40 phonedock-loader-ring" />
        </div>

        <p className="mt-5 text-base font-semibold text-slate-900 dark:text-slate-100">
          Loading PhoneDock
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Finding the latest phone data…
        </p>

        <div className="mt-5 flex items-center gap-1.5" aria-hidden="true">
          <span className="phonedock-loader-dot h-2 w-2 rounded-full bg-blue-500" />
          <span className="phonedock-loader-dot h-2 w-2 rounded-full bg-sky-500 [animation-delay:120ms]" />
          <span className="phonedock-loader-dot h-2 w-2 rounded-full bg-cyan-400 [animation-delay:240ms]" />
        </div>
      </div>

      <span className="sr-only">Loading PhoneDock content…</span>
    </main>
  );
}
