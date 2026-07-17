import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search Phones',
  description: 'Search for phones by name, brand, or specifications. Find the best phone for your needs and budget in Pakistan.',
  robots: { index: false, follow: true },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}