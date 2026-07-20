import { Sparkles, Trophy, WalletCards } from 'lucide-react';
import Link from 'next/link';
import type { Phone } from '@/components/shared/types';
import { buildComparisonSummary } from '@/lib/intelligence/phone-advisor';
import { formatPrice } from '@/components/shared/formatPrice';

export function SmartComparisonSummary({ phones }: { phones: Phone[] }) {
  const summary = buildComparisonSummary(phones);
  if (!summary) return null;

  return (
    <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-4 sm:p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-blue-600 p-2.5 text-white"><Sparkles className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Smart Comparison Summary</p>
          <h2 className="mt-1 text-xl font-extrabold text-gray-900">{summary.recommendedPhone?.modelName || 'Comparison verdict'}</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">{summary.verdict}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summary.winners.map(({ label, phone }) => phone && (
          <Link key={label} href={`/phones/${phone.slug}`} className="rounded-xl border border-white bg-white/80 p-3 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
              {label === 'Lowest price' ? <WalletCards className="h-4 w-4 text-emerald-500" /> : <Trophy className="h-4 w-4 text-amber-500" />}
              {label}
            </div>
            <p className="mt-1 truncate text-sm font-bold text-gray-900">{phone.modelName}</p>
            {label === 'Lowest price' && <p className="mt-1 text-xs font-semibold text-emerald-600">{formatPrice(phone.pricePKR)}</p>}
          </Link>
        ))}
      </div>
      <p className="mt-4 text-[11px] leading-5 text-gray-500">This recommendation is generated from PhoneDock scores and listed prices. Always check the full specifications and current market price before buying.</p>
    </section>
  );
}
