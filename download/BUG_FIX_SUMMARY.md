# PhoneDock — Bug Fix Summary

**Date:** 2026-07-18  
**Scope:** Production-grade functional audit and repair  
**Source of Truth:** `phonedock-main (12).zip`

---

## Critical Bug Fixes (3)

### Bug #1: Quick View Specs Not Displaying
- **Severity:** Critical  
- **Files Changed:** `PhoneCard.tsx`, `public.ts`, `reviews/[slug]/page.tsx`
- **Root Cause:** Three distinct data-path issues:
  1. Single-phone API (`/api/phones/:slug`) returned `related` phones without specs attached — every "You May Also Like" PhoneCard had empty specs
  2. Reviews page `getRelatedPhones()` manually constructed Phone objects omitting specs entirely
  3. PhoneCard's Quick View had inconsistent spec-field checking between main fetch and retry handler
- **Fix:**
  - `public.ts:206`: Changed `related.map(p => phoneToJSON(p))` → `await attachListSpecs(related)`
  - `reviews/[slug]/page.tsx`: Replaced manual Phone construction with `phoneToJSON()` + `attachSpecsToRawPhones()`
  - `PhoneCard.tsx`: Extracted `specsHasData()` helper; unified fetch logic; removed fragile `fetchAttemptedRef` guard

### Bug #2: Compare Page "Add Phones" Scroll Jump
- **Severity:** High  
- **File Changed:** `compare/page.tsx`
- **Root Cause:** Previous fix attempt used `useEffect` scroll approach; page already had Dialog-based picker but had dead `showPicker` state causing inconsistent behavior
- **Fix:** Removed dead `showPicker`/`setShowPicker` state (3 references); unified to `pickerOpen` state. When 1 phone loaded from URL, picker now auto-opens correctly.

### Bug #3: Admin Edit Phone HTTP 500
- **Severity:** Critical  
- **File Changed:** `admin-crud.ts`
- **Root Cause:** Gaps between individual try-catches — uncaught errors (e.g., `Phone.findOne()` for slug uniqueness, `revalidatePricePages()`) bubbled to generic 500 handler
- **Fix:**
  1. Top-level try-catch wrapping entire phone update block
  2. Slug uniqueness check wrapped in try-catch
  3. `revalidatePricePages()` call wrapped in try-catch
  4. Fixed `_previousPricePKR` bug — stored original price before updates
  5. Removed unnecessary `as any` casts (fields exist in schema)
  6. Fixed benchmark type coercion — string fields like "60 FPS" no longer forced to number

---

## Critical Audit Finding Fixes (5)

### Fix #4: News Cards Not Linking to Articles
- **Severity:** Critical  
- **Files Changed:** `HomeContent.tsx`, `news/page.tsx`
- **Issue:** Homepage news cards linked to `/news` (listing) instead of `/news/[slug]`. News listing cards had no navigation at all.
- **Fix:** Wrapped news cards in `<Link href={/news/${slug}}>`. Added click handlers on listing page cards.

### Fix #5: Admin PhoneForm Brand Dropdown Empty
- **Severity:** Critical  
- **Files Changed:** `admin/phones/new/page.tsx`, `admin/phones/[id]/edit/page.tsx`
- **Issue:** Both create and edit phone pages passed `brands={[]}` to PhoneForm, blocking phone creation
- **Fix:** Added `useEffect` to fetch brands from `/api/admin/brands?limit=200` on mount

### Fix #6: Missing `/admin` Redirect
- **Severity:** High  
- **File Created:** `admin/page.tsx`
- **Issue:** Visiting `/admin/` showed blank page
- **Fix:** Created server-side redirect to `/admin/dashboard`

### Fix #7: Phone TypeScript Type Missing Fields
- **Severity:** Medium  
- **File Changed:** `components/shared/types.ts`
- **Issue:** `phoneToJSON()` returns `priceMode`, `manualLock`, `manualLockReason`, `sourceUrl` but Phone interface didn't declare them
- **Fix:** Added 4 optional fields to Phone interface

### Fix #8: Phone Detail Page Missing Loading State
- **Severity:** High  
- **File Created:** `phones/[slug]/loading.tsx`
- **Issue:** Highest-traffic page showed blank white screen during data fetch
- **Fix:** Created shimmer skeleton matching the page's image + content grid layout

---

## Verification

| Check | Status |
|-------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run build` | ✅ Passes (all 36 routes compile) |
| `npm run lint` | ⚠️ 3 pre-existing errors (not introduced by changes), 752 warnings |

### Pre-existing ESLint Errors (Not Fixed — Out of Scope)
1. `route.ts:494` — `module` variable assignment (Next.js catch-all pattern)
2. `scripts/__tests__/first-setup.test.ts:70` — `require()` in test file
3. `phones/[slug]/page.tsx:81` — `useState` after conditional return in `PriceTrackerChart`

---

## Files Modified

| File | Change Type |
|------|-------------|
| `src/components/shared/PhoneCard.tsx` | Modified — unified QV fetch, specsHasData helper |
| `src/app/api/[[...path]]/handlers/public.ts` | Modified — attach specs to related phones |
| `src/app/reviews/[slug]/page.tsx` | Modified — proper specs attachment |
| `src/app/compare/page.tsx` | Modified — removed dead showPicker state |
| `src/app/api/[[...path]]/handlers/admin-crud.ts` | Modified — top-level try-catch, safe calls |
| `src/app/HomeContent.tsx` | Modified — news card links |
| `src/app/news/page.tsx` | Modified — news card navigation |
| `src/app/admin/phones/new/page.tsx` | Modified — fetch brands |
| `src/app/admin/phones/[id]/edit/page.tsx` | Modified — fetch brands |
| `src/app/admin/page.tsx` | Created — redirect to dashboard |
| `src/components/shared/types.ts` | Modified — added 4 Phone fields |
| `src/app/phones/[slug]/loading.tsx` | Created — loading skeleton |