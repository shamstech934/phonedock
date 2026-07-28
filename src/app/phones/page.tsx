import PhonesClient from './PhonesClient';
import { fetchPhoneListing, fetchPublicBrands, type PhoneListParams } from '@/lib/fetch-public-listings';
import type { Brand, Phone } from '@/components/shared/types';

export const revalidate = 300;

export default async function PhonesPage({ searchParams }: { searchParams: Promise<PhoneListParams> }) {
  const params = await searchParams;
  let phones: Phone[] = [];
  let brands: Brand[] = [];
  let total = 0;
  let queryKey = '';
  let initialError = '';

  try {
    const [listing, loadedBrands] = await Promise.all([
      fetchPhoneListing(params),
      fetchPublicBrands(),
    ]);
    phones = listing.phones;
    total = listing.total;
    queryKey = listing.queryKey;
    brands = loadedBrands;
  } catch (error) {
    console.error('[phones] Failed to load initial listing', error);
    initialError = 'Phone data is temporarily unavailable. Please try again shortly.';
  }

  return (
    <PhonesClient
      initialPhones={phones}
      initialBrands={brands}
      initialTotal={total}
      initialQueryKey={queryKey}
      initialError={initialError}
    />
  );
}
