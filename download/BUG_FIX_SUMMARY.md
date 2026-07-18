# BUG_FIX_SUMMARY.md — PhoneDock

## Bug 1: Quick View Shows No Specifications
- **Root Cause:** Three separate specs serialization implementations (`attachBasicSpecs`, `attachListSpecs`, `phoneToJSON`) returned different shapes and missed fields. PhoneSpecs data existed in MongoDB but the listing APIs mapped only 6 of 50+ fields.
- **Fix:** Created unified `serializePhoneSpecs()` in `helpers.ts`. Updated all three code paths to use it. Rebuilt PhoneCard Quick View as a Radix Dialog with full state machine (loading → loaded → empty → error → not-found).
- **Files Changed:**
  - `src/app/api/[[...path]]/handlers/helpers.ts`
  - `src/app/api/[[...path]]/handlers/public.ts`
  - `src/lib/fetch-home-data.ts`
  - `src/components/shared/PhoneCard.tsx`

## Bug 2: Compare "Add Phones" Causes Page Jump
- **Root Cause:** `useEffect` auto-scrolled to search input and focused it when `showPicker` changed. The picker was an inline section, not a proper modal.
- **Fix:** Replaced inline picker with Radix `Dialog` component. Removed scroll-to-search effect. Added proper search with AbortController, error handling, and selected-phone chips inside the dialog.
- **Files Changed:**
  - `src/app/compare/page.tsx`

## Bug 3: Admin Edit Phone Returns HTTP 500
- **Root Cause:** PhoneSpecs save received extra fields from client (`id`, `_count`, etc.) that aren't in the schema. Numeric fields (`ramGB`, `storageGB`) were sent as strings causing potential CastError. `findOneAndUpdate` without `strict: false` could reject unknown fields.
- **Fix:** Added explicit field allowlist. Added type coercion (numeric fields → Number, string fields → String). Added `strict: false`. Improved error logging. Applied same fix to benchmarks.
- **Files Changed:**
  - `src/app/api/[[...path]]/handlers/admin-crud.ts`

## Bug 4: Forgot/Reset Password Pages Unreachable
- **Root Cause:** `useAdmin.tsx` session guard redirected all unauthenticated admin paths to login, only excluding `/admin/login` and `/admin/first-setup`.
- **Fix:** Added `/admin/forgot-password` and `/admin/reset-password` to the exclusion list.
- **Files Changed:**
  - `src/lib/useAdmin.tsx`

## Bug 5: JSON-LD Logo 404 (SEO)
- **Root Cause:** News and review pages referenced `/logo.png` in structured data, but the actual file is `/logo.svg`.
- **Fix:** Changed `logo.png` → `logo.svg` in both files.
- **Files Changed:**
  - `src/app/news/[slug]/page.tsx`
  - `src/app/reviews/[slug]/page.tsx`

## Bug 6: Search Page Silently Swallows Errors
- **Root Cause:** Fetch `.catch()` only cleared loading state, setting results to empty. User saw "0 results" instead of an error message.
- **Fix:** Added `searchError` state, `res.ok` check, and distinct error UI with AlertCircle icon and retry button.
- **Files Changed:**
  - `src/app/search/page.tsx`

## Bug 7: PhoneForm No Double-Submit Guard
- **Root Cause:** Save buttons had `disabled={saving}` but `handleSubmit` could be called twice before React re-renders the disabled state.
- **Fix:** Added `if (saving) return;` as first line of `handleSubmit`.
- **Files Changed:**
  - `src/components/admin/phone-form/PhoneForm.tsx`

## Bug 8: Internal Links Using `<a>` Instead of `<Link>`
- **Root Cause:** Two pages used raw `<a href>` for internal navigation, causing full page reloads.
- **Fix:** Changed to Next.js `<Link>` components.
- **Files Changed:**
  - `src/app/how-we-test/page.tsx`
  - `src/app/faq/page.tsx`

## Bug 9: Video Cards Missing Thumbnail Fallback
- **Root Cause:** When `thumbnailUrl` was falsy, the card showed an empty gray box.
- **Fix:** Added Play icon placeholder inside the `aspect-video` div.
- **Files Changed:**
  - `src/app/videos/page.tsx`