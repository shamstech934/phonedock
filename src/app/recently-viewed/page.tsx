import type { Metadata } from 'next';
import { PersonalizedPhonesPage } from '@/components/shared/PersonalizedPhonesPage';

export const metadata: Metadata = {
  title: 'Recently Viewed Phones | SpecsDekh',
  description: 'Phones you recently viewed on SpecsDekh.',
  robots: { index: false, follow: true },
};

export default function RecentlyViewedPage() { return <PersonalizedPhonesPage mode="recent" />; }
