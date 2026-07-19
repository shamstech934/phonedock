import type { Metadata } from 'next';
import { Wallet } from 'lucide-react';
import { TopPhonesClientPage } from '@/components/shared/TopPhonesClientPage';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || '';

export const metadata: Metadata = {
  title: 'Best Budget Phones in Pakistan 2025',
  description: 'Best value smartphones under budget in Pakistan',
  alternates: { canonical: `${BASE_URL}/best-budget-phone` },
  openGraph: {
    title: 'Best Budget Phones in Pakistan 2025',
    description: 'Best value smartphones under budget in Pakistan',
    url: `${BASE_URL}/best-budget-phone`,
    type: 'website',
  },
};

export default function BestBudgetPhonePage() {
  return (
    <TopPhonesClientPage
      title="Best Budget Phones in Pakistan 2025"
      subtitle="Best value smartphones under budget in Pakistan"
      sort="valueScore"
      icon={<Wallet className="w-14 h-14" />}
      emptyHeading="No budget phone data yet"
      emptyDescription="Check back later for updated rankings"
    />
  );
}