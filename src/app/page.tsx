import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import HomeContent from './HomeContent';
import { fetchHomeData } from '@/lib/fetch-home-data';
import type { HomeData } from '@/components/shared/types';
import type { HeroPhone } from '@/components/shared/HeroPhoneShowcase';

export const dynamic = 'force-dynamic';
// ISR: revalidate every 60 seconds — Vercel CDN serves cached pages,
// only re-generates in background when cache expires.
export const revalidate = 60;

export default async function HomePage() {
  let homeData: HomeData;
  let heroPhones: HeroPhone[];

  try {
    const raw = await fetchHomeData();
    // phoneToJSON returns brand with {id, name, slug, logo} which is a subset of Brand — safe to cast
    homeData = raw as HomeData;
    heroPhones = raw.featured.slice(0, 6) as HeroPhone[];
  } catch {
    // If DB fails, return a minimal page with error
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md mx-auto px-4">
            <h2 className="text-lg font-bold text-gray-900">Couldn&apos;t load the homepage</h2>
            <p className="text-sm text-muted-foreground">Please try again in a moment.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return <HomeContent homeData={homeData} heroPhones={heroPhones} />;
}