import type { Metadata } from 'next';
import { Battery } from 'lucide-react';
import { TopPhonesClientPage } from '@/components/shared/TopPhonesClientPage';

import { getBaseUrl } from '@/lib/urls';
const BASE_URL = getBaseUrl();

export const metadata: Metadata = {
  title: 'Best Battery Phones in Pakistan 2026',
  description: 'Find smartphones with the longest battery life in Pakistan',
  alternates: { canonical: `${BASE_URL}/best-battery-phone` },
  openGraph: {
    title: 'Best Battery Phones in Pakistan 2026',
    description: 'Find smartphones with the longest battery life in Pakistan',
    url: `${BASE_URL}/best-battery-phone`,
    type: 'website',
  },
};

export default function BestBatteryPhonePage() {
  return (
    <TopPhonesClientPage
      title="Best Battery Phones in Pakistan 2026"
      subtitle="Find smartphones with the longest battery life in Pakistan"
      sort="batteryScore"
      rankingCategory="battery"
      badgeLabel="Battery"
      icon={<Battery className="w-14 h-14" />}
      emptyHeading="No battery phone data yet"
      emptyDescription="Check back later for updated rankings"
    />
  );
}
