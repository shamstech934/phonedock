import type { Metadata } from 'next';
import { PersonalizedPhonesPage } from '@/components/shared/PersonalizedPhonesPage';

export const metadata: Metadata = {
  title: 'Recently Viewed Phones | PhoneDock',
  description: 'Phones you recently viewed on PhoneDock.',
  robots: { index: false, follow: true },
};

export default function RecentlyViewedPage() { return <PersonalizedPhonesPage mode="recent" />; }
