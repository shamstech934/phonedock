import type { Metadata } from 'next';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { SmartPhoneFinder } from './SmartPhoneFinder';

export const metadata: Metadata = {
  title: 'Smart Phone Finder Pakistan | PhoneDock',
  description: 'Describe your budget and priorities in plain language and get matching smartphone filters for Pakistan.',
  alternates: { canonical: '/phone-finder' },
};

export default function PhoneFinderPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <SmartPhoneFinder />
      </main>
      <Footer />
    </div>
  );
}
