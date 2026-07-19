import type { Metadata } from 'next';
import { Clock } from 'lucide-react';
import { TopPhonesClientPage } from '@/components/shared/TopPhonesClientPage';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || '';

export const metadata: Metadata = {
  title: 'Upcoming Phones in Pakistan 2025',
  description: 'Discover upcoming smartphones launching in Pakistan',
  alternates: { canonical: `${BASE_URL}/upcoming` },
  openGraph: {
    title: 'Upcoming Phones in Pakistan 2025',
    description: 'Discover upcoming smartphones launching in Pakistan',
    url: `${BASE_URL}/upcoming`,
    type: 'website',
  },
};

export default function UpcomingPage() {
  return (
    <TopPhonesClientPage
      title="Upcoming Phones in Pakistan 2025"
      subtitle="Discover upcoming smartphones launching in Pakistan"
      icon={<Clock className="w-14 h-14" />}
      apiEndpoint="/api/upcoming-phones"
      emptyHeading="No upcoming phones listed yet"
      emptyDescription="Check back soon for the latest upcoming smartphones"
    />
  );
}