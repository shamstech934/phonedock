import type { Metadata } from 'next';
import { Gamepad2 } from 'lucide-react';
import { TopPhonesClientPage } from '@/components/shared/TopPhonesClientPage';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || '';

export const metadata: Metadata = {
  title: 'Best Gaming Phones in Pakistan 2025 | PhoneDock',
  description: 'Top smartphones for gaming in Pakistan with powerful processors and displays',
  alternates: { canonical: `${BASE_URL}/best-gaming-phone` },
  openGraph: {
    title: 'Best Gaming Phones in Pakistan 2025 | PhoneDock',
    description: 'Top smartphones for gaming in Pakistan with powerful processors and displays',
    url: `${BASE_URL}/best-gaming-phone`,
    type: 'website',
  },
};

export default function BestGamingPhonePage() {
  return (
    <TopPhonesClientPage
      title="Best Gaming Phones in Pakistan 2025"
      subtitle="Top smartphones for gaming in Pakistan with powerful processors and displays"
      sort="performanceScore"
      icon={<Gamepad2 className="w-14 h-14" />}
      emptyHeading="No gaming phone data yet"
      emptyDescription="Check back later for updated rankings"
    />
  );
}