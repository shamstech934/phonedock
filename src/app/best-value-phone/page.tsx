import type { Metadata } from 'next';
import { TrendingUp } from 'lucide-react';
import { TopPhonesClientPage } from '@/components/shared/TopPhonesClientPage';

import { getBaseUrl } from '@/lib/urls';
const BASE_URL = getBaseUrl();

export const metadata: Metadata = {
  title: 'Best Value Phones in Pakistan 2026',
  description: 'Smartphones with the best price-to-performance ratio in Pakistan',
  alternates: { canonical: `${BASE_URL}/best-value-phone` },
  openGraph: {
    title: 'Best Value Phones in Pakistan 2026',
    description: 'Smartphones with the best price-to-performance ratio in Pakistan',
    url: `${BASE_URL}/best-value-phone`,
    type: 'website',
  },
};

export default function BestValuePhonePage() {
  return (
    <TopPhonesClientPage
      title="Best Value Phones in Pakistan 2026"
      subtitle="Smartphones with the best price-to-performance ratio in Pakistan"
      sort="valueScore"
      rankingCategory="value"
      badgeLabel="Value"
      icon={<TrendingUp className="w-14 h-14" />}
      emptyHeading="No value phone data yet"
      emptyDescription="Check back later for updated rankings"
    />
  );
}
