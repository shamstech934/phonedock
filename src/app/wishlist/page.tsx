import type { Metadata } from 'next';
import { PersonalizedPhonesPage } from '@/components/shared/PersonalizedPhonesPage';

export const metadata: Metadata = {
  title: 'Wishlist | SpecsDekh',
  description: 'Your saved phones on SpecsDekh.',
  robots: { index: false, follow: true },
};

export default function WishlistPage() { return <PersonalizedPhonesPage mode="wishlist" />; }
