import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your Phone Wishlist',
  robots: { index: false, follow: true },
  alternates: { canonical: '/wishlist' },
};

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
