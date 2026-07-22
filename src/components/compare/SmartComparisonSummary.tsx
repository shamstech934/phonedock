import { AlertTriangle, BadgeCheck, Sparkles, Trophy, WalletCards } from 'lucide-react';
import Link from 'next/link';
import type { Phone } from '@/components/shared/types';
import { buildSmartComparison, getLowestPriceWinner } from '@/lib/intelligence/compare-engine';
import { formatPrice } from '@/components/shared/formatPrice';

export function SmartComparisonSummary({ phones }: { phones: Phone[] }) {
  const summary = buildSmartComparison(phones);
  if (!summary) return null;
  const cheapest = getLowestPriceWinner(phones);

  return (
    <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-4 sm:p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-blue-600 p-2.5 text-white"><Sparkles className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Smart comparison verdict</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${summary.dataConfidence === 'high' ? 'bg-emerald-100 text-emerald-700' : summary.dataConfidence === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
              {summary.dataConfidence} confidence
            </span>
          </div>
          <h2 className="mt-1 text-xl font-extrabold text-gray-900">{summary.recommendedPhone?.modelName || 'No clear overall winner'}</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">{summary.verdict}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summary.winners.map(winner => (
          <div key={winner.category} className="rounded-xl border border-white bg-white/80 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
              <Trophy className="h-4 w-4 text-amber-500" /> {winner.label}
            </div>
            {winner.phone ? (
              <>
                <Link href={`/phones/${winner.phone.slug}`} className="mt-1 block truncate text-sm font-bold text-gray-900 hover:text-blue-600">{winner.phone.modelName}</Link>
                <p className="mt-1 text-xs text-gray-500">{winner.score}/100 · {winner.confidence}% confidence</p>
              </>
            ) : <p className="mt-1 text-sm font-semibold text-gray-500">{winner.tie ? 'Tie' : 'Insufficient data'}</p>}
          </div>
        ))}
        {cheapest && (
          <Link href={`/phones/${cheapest.slug}`} className="rounded-xl border border-white bg-white/80 p-3 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500"><WalletCards className="h-4 w-4 text-emerald-500" /> Lowest listed price</div>
            <p className="mt-1 truncate text-sm font-bold text-gray-900">{cheapest.modelName}</p>
            <p className="mt-1 text-xs font-semibold text-emerald-600">{formatPrice(cheapest.pricePKR)}</p>
          </Link>
        )}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {summary.insights.map(insight => (
          <div key={insight.phone.id} className="rounded-xl border border-blue-100 bg-white/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/phones/${insight.phone.slug}`} className="truncate text-sm font-bold text-gray-900 hover:text-blue-600">{insight.phone.modelName}</Link>
              <span className="shrink-0 text-[10px] font-semibold text-gray-500">{insight.dataConfidence}% data</span>
            </div>
            {insight.strengths.length > 0 && <p className="mt-2 flex items-start gap-1.5 text-xs text-emerald-700"><BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Strong in {insight.strengths.join(', ')}</p>}
            {insight.bestFor.length > 0 && <p className="mt-1.5 text-xs font-medium text-blue-700">Best for: {insight.bestFor.join(', ')}</p>}
            {insight.tradeoffs.length > 0 && <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {insight.tradeoffs.slice(0, 2).join(' · ')}</p>}
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] leading-5 text-gray-500">Scores use only available PhoneDock data. Estimated scores and unverified prices reduce confidence; always confirm current market price and full specifications before buying.</p>
    </section>
  );
}
