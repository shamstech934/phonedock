import PhonesClient from './PhonesClient';
import { fetchPhoneListing, fetchPublicBrands, type PhoneListParams } from '@/lib/fetch-public-listings';

export const dynamic = 'force-dynamic';

export const revalidate = 300;

export default async function PhonesPage({ searchParams }: { searchParams: Promise<PhoneListParams> }) {
  const params = await searchParams;
  const [{ phones, total, queryKey }, brands] = await Promise.all([
    fetchPhoneListing(params),
    fetchPublicBrands(),
  ]);

  return (
    <PhonesClient
      initialPhones={phones}
      initialBrands={brands}
      initialTotal={total}
      initialQueryKey={queryKey}
    />
  );
}
