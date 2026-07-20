import BrandsClient from './BrandsClient';
import { fetchPublicBrands } from '@/lib/fetch-public-listings';

export const revalidate = 1800;

export default async function BrandsPage() {
  const brands = await fetchPublicBrands();
  return <BrandsClient initialBrands={brands} />;
}
