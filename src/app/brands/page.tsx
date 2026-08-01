import BrandsClient from './BrandsClient';
import { fetchPublicBrands } from '@/lib/fetch-public-listings';

// Brand data comes from MongoDB at request time. Do not prerender this page in CI,
// because GitHub runners may not be allowed by Atlas Network Access.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BrandsPage() {
  try {
    const brands = await fetchPublicBrands();
    return <BrandsClient initialBrands={brands} />;
  } catch (error) {
    console.error('Unable to load public brands at request time:', error);
    return <BrandsClient initialBrands={[]} />;
  }
}
