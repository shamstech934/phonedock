# Google Search Console sitemap fix

This build removes the duplicate Next.js metadata sitemap (`src/app/sitemap.ts`) so
`/sitemap.xml` has exactly one route owner: `src/app/sitemap.xml/route.ts`.

It also:

- keeps all sitemap routes outside `src/proxy.ts`;
- returns direct XML responses with HTTP 200;
- removes relative brand-logo entries from the image sitemap;
- accepts only valid absolute HTTP(S) phone image URLs;
- filters malformed news slugs;
- removes artificial per-request `<lastmod>` values from the sitemap index;
- adds explicit XML/cache headers for every sitemap route.

After deployment, remove the old sitemap entry in Search Console and submit only:

`https://specsdekh.com/sitemap.xml`

Google may retain the previous 308/invalid-URL status until it fetches the newly
deployed response again.
