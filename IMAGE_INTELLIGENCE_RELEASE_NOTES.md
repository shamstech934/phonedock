# SpecsDekh v24.0 — Image Intelligence

Implemented a complete low-load Image Intelligence module.

## Added
- Admin page: `/admin/image-intelligence`
- API: `GET/POST /api/admin/image-intelligence`
- Persistent `ImageIntelligenceSignal` review queue
- Capped scanner (default 150, maximum 500 phones)
- Missing image and thumbnail detection
- Invalid/insecure URL detection
- Missing alt text detection
- Duplicate URL detection
- Thumbnail/gallery consistency checks
- Admin-approved apply and dismiss actions
- Activity logging and public cache revalidation
- Extended optional image metadata fields
- Documentation and version bump to 24.0.0

## Safety
- No paid AI
- No image scraping or downloading
- No automatic publishing
- Every change requires admin approval

## Verification
- Static production audit passed: 89 routes, 0 broken links, 0 old-origin references, 0 visible legacy branding.
- Full TypeScript/build verification should run in GitHub/Vercel where dependencies are installed.
