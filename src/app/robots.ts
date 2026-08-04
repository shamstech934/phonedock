import { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/urls';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/admin/', '/api/', '/account/', '/profile/', '/wishlist/', '/recently-viewed/', '/login/', '/signup/', '/search'],
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: ['/admin/', '/api/', '/account/', '/profile/', '/wishlist/', '/recently-viewed/', '/login/', '/signup/', '/search'],
      },
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/account/', '/profile/', '/wishlist/', '/recently-viewed/', '/login/', '/signup/', '/search'],
      },
    ],
    sitemap: `${getBaseUrl()}/sitemap.xml`,
  };
}