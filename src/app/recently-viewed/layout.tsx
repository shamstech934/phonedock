import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Recently Viewed Phones',
  robots: { index: false, follow: true },
  alternates: { canonical: '/recently-viewed' },
};

export default function RecentlyViewedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
