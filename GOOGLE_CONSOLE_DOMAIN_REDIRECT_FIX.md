# Google Search Console domain redirect fix

This build removes the duplicate application-level `www.specsdekh.com` redirect.

The only remaining host redirect must be configured in Vercel Domains:

- Primary: `specsdekh.com`
- `www.specsdekh.com`: Redirect to `specsdekh.com`

There must be one hop only:

`https://www.specsdekh.com/robots.txt` -> `https://specsdekh.com/robots.txt`

The application still emits canonical URLs and sitemap URLs on `https://specsdekh.com`.
