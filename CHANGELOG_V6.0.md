# PhoneDock v6.0.0 — SEO & Performance

## Added
- Shared SEO metadata builder with canonical URL normalization.
- Dynamic 1200×630 Open Graph and Twitter social image routes.
- Consistent phone-detail Open Graph, Twitter, canonical, and keyword metadata.
- Public API CDN cache policies with stale-while-revalidate.
- Package import optimization for Lucide and Framer Motion.
- Automated SEO/performance regression test.

## Changed
- Disabled the framework signature header.
- Enabled response compression explicitly.
- Phone metadata now uses one safe, reusable generator.

## Safety
- Admin and private API routes remain no-store.
- Search pages remain noindex.
- No database migration is required.
