---
Task ID: 1
Agent: main
Task: Price Tracker V1 — Complete missing pieces

Work Log:
- Inspected existing codebase: found ~90% of Price Tracker V1 was already implemented (models, 7-tab admin UI, API handlers, cron endpoint, price history graph, phone form extensions)
- Identified 6 gaps: SSRF protection, configurable settings, test-source endpoint, CRON_SECRET docs fix, tests, report
- Created `src/lib/ssrf-guard.ts` — comprehensive SSRF protection with IPv4/IPv6 private IP detection, DNS resolution checking, domain whitelist matching
- Added SSRF validation to cron endpoint before every URL fetch
- Added GET/PUT `/api/admin/price-tracker/settings` endpoints with validation (stored in SystemState)
- Updated cron to use configurable thresholds (autoApproveThreshold, reviewThreshold, batchSize) from settings
- Made Settings tab editable with live form, save button, validation, and "Saved" feedback
- Fixed CRON_SECRET documentation (was showing `?secret=` query param, corrected to `x-cron-secret` header)
- Wrote 43 SSRF guard unit tests (all passing) covering safeHostname, isPrivateUrl, isDomainAllowed, validateUrlForFetch
- Fixed IPv4→IPv6 CIDR comparison bug in initial ssrf-guard implementation
- Removed duplicate BATCH_SIZE variable in cron handler
- Verified: tsc --noEmit pass, ESLint pass, next build pass
- Created PRICE_TRACKER_VERSION1_REPORT.md

Stage Summary:
- All Price Tracker V1 features are now complete
- Key new files: src/lib/ssrf-guard.ts, scripts/__tests__/ssrf-guard.test.ts, PRICE_TRACKER_VERSION1_REPORT.md
- Key modified files: cron-update-prices.ts (SSRF + configurable thresholds), price-tracker.ts (settings API), price-tracker/page.tsx (editable settings tab)
- Build and tests verified passing
---
Task ID: 2
Agent: main
Task: Fix PhoneCard Quick View, Compare, Category Buttons, Hero Mobile Layout, and Phones Page Filters

Work Log:
- Investigated Quick View bug: `.glass-shine` CSS class has `overflow: hidden` which clips the absolute-positioned popover above the card
- Changed Quick View from clipped popover to inline expanded panel within the card (no overflow issues)
- Added touch support for closing Quick View (touchstart event)
- Improved Compare page: pre-selected phones now shown as prominent blue chips INSIDE the picker area (not below the fold)
- Fixed Category Buttons: Latest → `/phones?sort=newest`, Trending → `/phones?sort=trending`, PTA → `/phones?pta=approved`, Flagship → `/phones?price=above100k&sort=rating`, Price Drops → `/phones?priceDrop=true`
- Fixed Hero mobile: reduced text sizes (h1: text-2xl on mobile, text-xs description), smaller search/buttons/padding, shorter phone showcase height
- Fixed Phones Page: PTA/5G/NFC filter params were read from URL but never sent to the API — now properly sent
- Added API support: `trending` sort, `pta` filter, `5g` filter, `nfc` filter, `priceDrop` filter in public.ts handler
- Added "Trending" sort option to phones page dropdown
- Build verified: tsc clean, next build successful, 0 ESLint errors (only pre-existing warnings)

Stage Summary:
- 6 files modified: PhoneCard.tsx, compare/page.tsx, HomeContent.tsx, phones/page.tsx, public.ts
- All 4 user-reported bugs fixed + 1 hidden bug (phones page filters not sent to API) discovered and fixed
---
Task ID: 1
Agent: main
Task: Fix Quick View specs, Compare Add Phones button, and batch specs on all endpoints

Work Log:
- Analyzed screenshots via VLM to understand actual UI state
- Tested deployed API: confirmed ZERO phones have PhoneSpecs documents in DB (root cause of "no specs")
- Fixed PhoneCard Quick View: now hides empty panel when no specs data (shows nothing instead of useless "No specs available yet")
- Added 5-second timeout with AbortController to Quick View fetch
- Added hasSpecsData check to avoid treating empty-specs objects as having data
- Fixed Compare "Add Phones" button: replaced inline setTimeout scroll with useEffect on showPicker state
- Created reusable attachListSpecs() helper in public.ts
- Applied batch specs to ALL listing endpoints: /api/phones, /api/phones/lookup, /api/brands/:slug, /api/search, /api/top-phones, /api/upcoming-phones, /api/phones-under/:price
- Refactored /api/phones to use shared helper instead of inline batch code

Stage Summary:
- Quick View no longer shows useless empty panel - clicking eye icon on a phone without specs does nothing (no confusing "loading" or "no specs" message)
- Compare "Add Phones" button now reliably scrolls to and focuses the search input via useEffect
- All listing endpoints now consistently attach basic specs when PhoneSpecs documents exist
- Pushed as commit f759bad
---
Task ID: 3
Agent: admin-500-fix
Task: Fix Admin Edit Phone HTTP 500 error

Work Log:
- Read full admin-crud.ts (1665 lines) — verified ALL imports present: ActivityLog, PhoneSpecs, PhoneBenchmark, PhoneImage, PhonePrice, PriceHistory, Brand, revalidatePricePages
- Read revalidatePricePages in src/lib/revalidate.ts — function is synchronous with internal try-catch on each revalidatePath call; confirmed safe
- Read Phone.ts model schema — confirmed priceMode, manualLock, manualLockReason, sourceUrl, sourceName are all proper schema fields (lines 63-65, 104-105)
- Read PhoneSpecs.ts model schema — all 52 string fields + 5 numeric fields match allowedSpecKeys in handler
- Read PhoneSub.ts — confirmed PhoneBenchmark schema: pubgFps/codMobileFps/genshinFps/videoPlayback/gamingBattery/browsingBattery are String type (not Number)
- Read route.ts — identified the PUT handler catch at line 414-421 returns generic {"error":"Internal server error", details: msg} when handleAdminCrudPut throws
- Identified ROOT CAUSE: The phone update handler (lines 1092-1257) had gaps between individual try-catches. Specifically, Phone.findOne() for slug uniqueness check (line 1109) was NOT in a try-catch — any DB error there would bubble up as a generic 500. Additionally, any other unexpected error between the inner try-catches would escape to route.ts's generic handler.

Fixes applied to src/app/api/[[...path]]/handlers/admin-crud.ts:
1. **Top-level try-catch** (lines 1111-1289): Wrapped the entire field-update-and-save block in a catch-all that returns `{"error":"Failed to update phone","details":"<message>"}` instead of the generic "Internal server error"
2. **Slug uniqueness check try-catch** (lines 1116-1122): Wrapped Phone.findOne for slug check in its own try-catch with meaningful error response
3. **Safe revalidatePricePages call** (lines 1277-1281): Wrapped in try-catch as defense-in-depth even though the function has internal try-catch
4. **Fixed _previousPricePKR bug** (lines 1102, 1272-1274): Stored original price before updates (`const _previousPricePKR = phone.pricePKR`) and compare against it. Previously used `(phone as any)._previousPricePKR` which was never set, causing a PriceHistory entry to be created on EVERY save regardless of whether price changed
5. **Removed unnecessary `as any` casts** (lines 1169-1172): Changed `(phone as any).priceMode = priceMode` → `phone.priceMode = priceMode` (and same for manualLock, manualLockReason, sourceUrl, sourceName) since these are proper Phone schema fields
6. **Fixed benchmark type coercion** (lines 1238-1249): String-type benchmark fields (pubgFps, codMobileFps, genshinFps, videoPlayback, gamingBattery, browsingBattery) are now preserved as strings instead of being coerced to numbers via `Number(val) || 0`

Verification: `npx tsc --noEmit --pretty` — 0 errors

Stage Summary:
- The 500 error was caused by uncaught exceptions (e.g., from Phone.findOne slug check) bubbling up to route.ts's generic error handler
- Added comprehensive try-catch coverage ensuring all errors return meaningful JSON responses
- Also fixed a data quality bug (duplicate PriceHistory entries on every save) and a type coercion bug (benchmark string fields forced to numbers)
- TypeScript compilation verified clean

---
Task ID: 2
Agent: quick-view-fix
Task: Fix Quick View specs display bug

Work Log:
- Traced all 14 files that render PhoneCard to identify which data paths provide specs
- Verified all listing APIs (`/api/phones`, `/api/brands/:slug`, `/api/search`, `/api/top-phones`, `/api/upcoming-phones`, `/api/phones-under/:price`, `/api/home`) properly call `attachListSpecs()` or `attachBasicSpecs()` to pre-attach specs
- Found Bug 1: `/api/phones/:slug` endpoint (public.ts:206) returned `related` phones with `phoneToJSON(p)` WITHOUT specs — the Quick View fallback fetch was the only way to get specs for these phones
- Found Bug 2: Reviews page (`/reviews/[slug]/page.tsx`) `getRelatedPhones()` manually constructed Phone objects without specs — same issue, no pre-attached specs
- Found Bug 3: Quick View `handleRetry` had an incomplete spec check (missing `selfieCamera`, `chargingSpeed`, `os` fields) compared to the main effect
- Found Bug 4: Quick View used `fetchAttemptedRef` guard that could prevent re-fetching in edge cases (e.g., React strict mode double-mount)
- Fixed public.ts: Changed `related.map((p: any) => phoneToJSON(p))` to `await attachListSpecs(related)` 
- Fixed reviews/[slug]/page.tsx: Replaced manual Phone construction with `phoneToJSON()` + `attachSpecsToRawPhones()` using shared helpers
- Refactored PhoneCard.tsx QuickViewContent:
  - Extracted `specsHasData()` helper to eliminate duplicated/inconsistent spec-checking logic
  - Replaced `fetchAttemptedRef` guard with cleaner `fetchSpecs` callback + `specsRef` pattern
  - Unified the main effect and retry handler to share the same `fetchSpecs` function
  - Fixed incomplete spec check in retry path
- Verified TypeScript compilation passes with `npx tsc --noEmit` (0 errors)

Stage Summary:
- Root causes: (1) Two code paths served PhoneCards without specs attached, forcing reliance on fallback fetch; (2) Quick View had fragile fetch guard and duplicated/inconsistent spec validation logic
- Three files changed: `public.ts`, `reviews/[slug]/page.tsx`, `PhoneCard.tsx`
- Build compiles cleanly with zero TypeScript errors
---
Task ID: 4
Agent: api-audit
Task: Audit API response shapes across all endpoints

Work Log:
- Read all 8 handler files completely: public.ts, admin-crud.ts, admin-auth.ts, collector.ts, price-tracker.ts, import.ts, first-setup.ts, cron-update-prices.ts, download.ts, and route.ts
- Catalogued ~105 endpoints across GET/POST/PUT/DELETE methods
- Classified each endpoint's success and error response shape
- Searched 62 frontend files (37 with direct fetch calls, ~108 total API calls)
- Identified error response patterns: 80+ use `{ error: "string" }`, 0 use proposed `{ success: false, error: { code, message } }`
- Checked authentication coverage on all endpoints (all properly covered)
- Identified information disclosure: PUT route catch and phone save leak `details: e.message`
- Identified caching: 22 public GET endpoints use `cached()` helper; 0 admin endpoints cache; correct behavior
- Wrote comprehensive audit report to /home/z/my-project/download/API_RESPONSE_AUDIT.md

Stage Summary:
- Zero endpoints follow the proposed `{ success: true, data }` / `{ success: false, error: { code, message } }` envelope
- 70 endpoints return raw domain data without any `success` wrapper
- 25 endpoints use `{ success: true, ... }` for mutations but without a `data` key
- 3 information disclosure issues found (PUT error details leaked to client)
- 37 frontend files / ~108 fetch calls would break if envelope is applied
- 4-phase migration plan documented with risk assessment
- Report saved to /home/z/my-project/download/API_RESPONSE_AUDIT.md
---
Task ID: 6
Agent: admin-audit
Task: Full admin panel functional audit

Work Log:
- Explored full admin directory structure: 23 page files across admin/
- Read admin layout.tsx: Auth guard via AdminAuthProvider, sidebar nav with permission filtering, change password modal, mobile responsive tabs
- Read auth.ts: JWT sessions, bcrypt, rate limiting, reset tokens, input sanitization
- Read permissions.ts: 6 roles (superadmin/admin/editor/moderator/reviewer/viewer) with granular permission sets
- Read useAdmin.tsx: Context-based auth state, session verification, auto-redirect for unauthenticated users
- Audited all 23 admin pages for rendering, CRUD wiring, validation, loading/error states, permissions
- Read all 13 phone-form components (PhoneForm, 8 section components, FormFields, types, index)
- Checked for unused imports, TODO/FIXME comments, dead code
- Found 2 critical issues: brands=[] in PhoneForm, missing /admin/page.tsx redirect
- Found 4 warnings: dead "New Article" button, missing news create/edit pages, wrong delete API call, missing root page
- Found 6 minor issues: unused imports in 4 files, swallowed errors, permission map divergence, missing client-side password validation
- Generated comprehensive audit report with 30 page entries, component audit, auth assessment, loading/error state matrix

Stage Summary:
- 2 critical issues (PhoneForm brands prop empty, missing admin root page)
- 4 warnings (news CRUD incomplete, collector sources delete bug)
- 6 minor issues (unused imports, swallowed errors, permission map gap)
- 0 TODO/FIXME comments found in admin code
- Report saved to /home/z/my-project/download/ADMIN_PANEL_AUDIT.md

---
Task ID: 5
Agent: public-audit
Task: Full public website functional audit

Work Log:
- Read all 30 public-facing page files in src/app/
- Read all 7 shared components in src/components/shared/
- Read fetch-home-data.ts and TurnstileWidget.tsx
- Searched for TODO/FIXME comments, unused imports, dangerouslySetInnerHTML usage
- Analyzed every page for: render, interactivity, loading states, error states, responsiveness, valid internal links, dead code
- Compiled findings into structured audit report with severity ratings

Stage Summary:
- 1 Critical issue: Homepage news cards navigate to /news listing instead of individual article slug
- 1 High issue: News listing page articles are entirely non-clickable (cursor-pointer but no onClick/Link)
- 1 High issue: Newsletter subscription form is fake (no API call, client-side only)
- 1 High issue: Phone detail page /phones/[slug] has no loading.tsx (blank screen during load)
- 1 High issue: Unused `dynamic` import in phone detail page
- 6 Medium issues: XSS risk on news content, brand detail fetches all phones client-side, price alert silently swallows errors, 8 force-dynamic pages missing loading.tsx, price range slug mismatch risk, reviews related phones dead brandSlug param
- 5 Low issues: Footer unused icon props, trust bar unused icon data, full BASE_URL in SSR fetches, dynamic export before imports, duplicate Plus icon
- Report saved to /home/z/my-project/download/PUBLIC_WEBSITE_AUDIT.md
---
Task ID: 7
Agent: db-image-audit
Task: Database schema integrity and image audit

Work Log:
- Read all 15 Mongoose model files in src/lib/models/ (Phone, PhoneSpecs, Brand, PhoneSub, PriceTracker, CollectedPhone, ImportHistory, SystemState, CollectorSource, Other, Settings, SyncJob, CollectorJob, AdminSession, Video)
- Read models/index.ts to verify all 24 exported symbols match imports across 10 handler files
- Audited indexes on all models — identified 3 missing indexes (PhoneImage compound, Sponsor, Review compound)
- Checked all schema field types, required constraints, enums, and defaults for correctness
- Verified all 17+ relationship refs (ref: 'Model') across schemas
- Analyzed cascading delete logic for phone deletion — found 6 missing cascade targets (PriceHistory, Review, UserReview, PriceAlert, PriceTrackerHistory, PhoneRetailListing)
- Checked Settings model updatedAt auto-update behavior — found it's broken (manual field, no timestamps:true)
- Audited all 19 components/files with <Image> tags for proper alt text (found 1 empty-string fallback)
- Verified image fallback patterns across all components (found 1 missing fallback)
- Confirmed all 5 remote image domains in next.config.ts are properly configured
- Confirmed CSP img-src directive is aligned with image domains
- Verified no raw <img> tags exist — all use Next.js Image component
- Cross-referenced serializePhoneSpecs() 51 string + 5 numeric fields against PhoneSpecs schema — exact 1:1 match
- Cross-referenced phoneToJSON() output fields against Phone schema and Phone TypeScript type
- Identified duplicated OFFICIAL_LOGOS constant across two files
- Identified redundant dynamic Sponsor import in admin-crud.ts

Stage Summary:
- 1 High severity: Phone delete missing PriceHistory cascade (orphan accumulation)
- 6 Medium severity: Missing PhoneImage compound index, Phone TypeScript type missing 4 fields, Settings updatedAt broken, 5 additional missing cascades on phone delete, duplicated OFFICIAL_LOGOS, empty alt text on gallery thumbnails
- 7 Low severity: CollectorSource no unique name, Sponsor/Review missing indexes, IBrand type narrowing, redundant import, Wikipedia URL fragility, review page missing thumbnail fallback
- All image domains properly configured, no raw <img> tags, all alt text present (1 weak)
- serializePhoneSpecs() and phoneToJSON() perfectly aligned with schemas
- All model imports across 10 handler files verified correct
- Report saved to /home/z/my-project/download/DB_IMAGE_AUDIT.md
---
Task ID: 7b
Agent: critical-fixes
Task: Fix critical audit findings

Work Log:
- ISSUE 1a: Fixed homepage news cards in HomeContent.tsx — changed `<div onClick={router.push('/news')}>` to `<Link href={/news/${n.slug}}>` wrapping each news card
- ISSUE 1b: Fixed news listing page /news/page.tsx — added `useRouter` import and `onClick` handlers to both the featured article and grid articles, routing to `/news/${slug}`
- ISSUE 2: Fixed PhoneForm brand dropdown — updated /admin/phones/new/page.tsx and /admin/phones/[id]/edit/page.tsx to fetch brands from `/api/admin/brands?limit=200` and pass them to PhoneForm instead of empty array
- ISSUE 3: Created /admin/page.tsx with Next.js `redirect('/admin/dashboard')` so visiting /admin/ redirects properly
- ISSUE 4: Added 4 missing fields to Phone interface in types.ts: `priceMode?: string`, `manualLock?: boolean`, `manualLockReason?: string`, `sourceUrl?: string`
- ISSUE 5: Created /phones/[slug]/loading.tsx with skeleton matching the page layout (image + content grid with shimmer placeholders)
- Ran `npx tsc --noEmit` — zero type errors

Stage Summary:
- All 5 critical audit issues resolved
- TypeScript compilation passes cleanly
- News cards now navigate to individual articles on both homepage and listing page
- Admin phone forms now populate brand dropdown with fetched data
- /admin/ now redirects to /admin/dashboard
- Phone type interface complete with all fields from phoneToJSON()
- Phone detail page has proper loading skeleton
---
Task ID: 8
Agent: main
Task: Fix all ESLint errors, medium/low audit issues, run performance/accessibility audits, production verification

Work Log:
- Fixed 3 ESLint errors: module→moduleName (admin-crud.ts), require→dynamic import (route.ts), conditional useState (phones/[slug]/page.tsx)
- Fixed newsletter fake form: created NewsletterSubscriber model, POST /api/newsletter endpoint, wired HomeContent component
- Fixed price alert empty catch: added error state and user feedback
- Fixed gallery thumbnail empty alt text: fallback to phone.modelName
- Fixed reviews related phones: now filters by brand using brandSlug parameter
- Fixed collector sources delete: changed from wrong /api/collector/jobs to correct /api/collector/sources/{id}
- Fixed phone delete cascade: added PriceHistory, UserReview, PriceAlert, PhoneRetailListing, PriceTrackerHistory
- Fixed Settings updatedAt: replaced manual field with Mongoose timestamps:true
- Fixed admin layout rolePerms: added viewer and moderator roles
- Removed unused imports from 4 files (admin/news, admin/activity, admin/reviews, compare)
- Removed unused 'dynamic' import from phones/[slug]/page.tsx
- Created 7 loading.tsx skeleton files for force-dynamic pages
- Made nodemailer fully dynamic import (removed ~1MB from cold start)
- Added .limit(365) to unbounded price-history query
- Ran accessibility audit → 24 issues found (report saved)
- Ran performance audit → 23 issues found (report saved)
- Updated BUG_FIX_SUMMARY.md with all 24 fixes
- Production verification: tsc 0 errors, ESLint 0 errors, next build passes

Stage Summary:
- All 3 original critical bugs + 21 additional issues fixed (24 total fixes)
- 0 TypeScript errors, 0 ESLint errors, production build passes
- 6 audit reports generated: API_RESPONSE_AUDIT, ADMIN_PANEL_AUDIT, PUBLIC_WEBSITE_AUDIT, DB_IMAGE_AUDIT, ACCESSIBILITY_AUDIT, PERFORMANCE_AUDIT
- 3 deliverable reports updated: BUG_FIX_SUMMARY, FUNCTIONAL_AUDIT_REPORT, FUNCTIONAL_TEST_MATRIX

---
Task ID: 9
Agent: main
Task: Fix Quick View clipping, Compare scroll jump, create SafePhoneImage

Work Log:
- Analyzed root cause: Dialog z-index (z-50) equals sticky header z-index (z-50), causing dialog to render behind header
- Bumped Dialog overlay and content z-index from z-50 to z-[100] in dialog.tsx
- Confirmed Quick View already uses Radix DialogPortal (renders to document.body, outside card grid)
- Confirmed Compare page already had scrollIntoView removed from previous fix
- Removed autoFocus from Compare picker search input (was causing scroll jumps)
- Created SafePhoneImage shared component with failed URL caching, Smartphone fallback, object-contain
- Rewrote PhoneCard.tsx: SafePhoneImage, formatSpecValue (never shows [object Object]), normalizeSpecs, extractSpecsFromResponse (5 shapes), explicit states (idle/loading/success/empty/error), fetchIdRef for stale prevention, eye button ref for focus return
- Replaced raw Image in Compare page with SafePhoneImage (selected chips + search results)
- Cleaned unused imports (Smartphone from PhoneCard, Star/Monitor/ useCallback from Compare)

Stage Summary:
- Files changed: dialog.tsx, PhoneCard.tsx, compare/page.tsx, SafePhoneImage.tsx (new)
- TypeScript: 0 errors. ESLint: 0 errors
- Playwright verified: scrollIntoView=False, autoFocus=False, 0px scroll diff on picker open
- Screenshots: test-results/quick-view-fixed.png, test-results/compare-picker-fixed.png
