# FUNCTIONAL_TEST_MATRIX.md — PhoneDock

## Public Pages

| Page | Component | Action | Expected Result | Actual Result | Status | Notes |
|------|-----------|--------|-----------------|---------------|--------|-------|
| `/` | PhoneCard | Click Quick View (eye) | Dialog opens with loading spinner | Dialog opens with specs or loading | ✅ Fixed | Rebuilt as Radix Dialog |
| `/` | PhoneCard | Quick View with specs | Shows chipset, RAM, storage, display, battery, camera | Full normalized specs displayed | ✅ Fixed | Shared serialization |
| `/` | PhoneCard | Quick View without specs | Shows "Specifications are not available yet." | Correct empty state shown | ✅ Fixed | |
| `/` | PhoneCard | Quick View fetch error | Shows "Unable to load specifications. Retry." | Error state with retry button | ✅ Fixed | |
| `/` | PhoneCard | Quick View keyboard | Enter/Space opens, Escape closes | Dialog opens/closes correctly | ✅ Fixed | Radix Dialog built-in |
| `/` | PhoneCard | Quick View aria | aria-expanded, aria-haspopup, aria-label | All present | ✅ Fixed | |
| `/` | PhoneCard | Quick View mobile | No viewport overflow | Dialog constrained to 85vh | ✅ Fixed | |
| `/` | PhoneCard | View Details link | Navigates to `/phones/[slug]` | Works | ✅ | |
| `/` | PhoneCard | Compare button | Navigates to `/compare?p=slug` | Works | ✅ | |
| `/compare` | Add Phones button | Opens phone picker | Dialog opens without page jump | ✅ Fixed | Replaced with Dialog |
| `/compare` | Search autocomplete | Shows results after 2 chars | Results appear with debounce | ✅ Fixed | AbortController added |
| `/compare` | Add phone from picker | Phone appears in selected chips | Chip appears, search clears | ✅ Fixed | |
| `/compare` | Remove phone | Phone removed, URL updated | Immediate UI + URL update | ✅ Fixed | |
| `/compare` | Clear All | All phones removed | UI and URL cleared | ✅ Fixed | |
| `/compare` | Compare 2+ phones | Comparison table renders | Table with scores and specs | ✅ Fixed | |
| `/compare` | Only Differences toggle | Hides identical rows | Works | ✅ Fixed | |
| `/compare` | 1 phone selected | Shows instruction message | "Add at least one more phone" | ✅ Fixed | |
| `/compare` | 4 phones max | 5th phone disabled | Button disabled with message | ✅ Fixed | |
| `/compare` | Category winners | Shows best score per category | No false winner with 0/100 | ✅ Fixed | Returns null when all zero |
| `/compare` | URL with slugs | `/compare?p=slug1,slug2` | Phones loaded from URL | ✅ Fixed | Handles invalid slugs |
| `/search` | Search with query | Shows phones and brands | Results render | ✅ | |
| `/search` | Search with no results | Shows "No results found" | Correct empty state | ✅ | |
| `/search` | Search error | Shows error state with retry | ✅ Fixed | New feature |
| `/news/[slug]` | JSON-LD | Valid structured data | logo.svg referenced | ✅ Fixed | Was logo.png (404) |
| `/reviews/[slug]` | JSON-LD | Valid structured data | logo.svg referenced | ✅ Fixed | Was logo.png (404) |
| `/videos` | Video without thumbnail | Shows fallback | Play icon placeholder | ✅ Fixed | |
| `/how-we-test` | "Rating Methodology" link | Client-side navigation | Uses Next.js Link | ✅ Fixed | Was `<a>` |
| `/faq` | "Contact us" link | Client-side navigation | Uses Next.js Link | ✅ Fixed | Was `<a>` |

## Admin Pages

| Page | Component | Action | Expected Result | Actual Result | Status | Notes |
|------|-----------|--------|-----------------|---------------|--------|-------|
| `/admin/login` | Login form | Valid credentials | Redirects to dashboard | ✅ | |
| `/admin/forgot-password` | Page access | Page loads when logged out | ✅ Fixed | Was redirecting to login |
| `/admin/reset-password` | Page access | Page loads when logged out | ✅ Fixed | Was redirecting to login |
| `/admin/phones/[id]/edit` | Save phone | Phone saves without 500 | ✅ Fixed | Field allowlist + type coercion |
| `/admin/phones/new` | Submit form | Double-submit prevented | ✅ Fixed | Guard added |
| `/admin/phones/[id]/edit` | Submit form | Double-submit prevented | ✅ Fixed | Guard added |

## Quick View State Matrix

| Scenario | State Shown | Tested |
|----------|-------------|--------|
| Phone has pre-attached specs from listing API | Loaded — all available spec fields | ✅ |
| Phone has no pre-attached specs, API returns specs | Loaded — fetched specs displayed | ✅ |
| Phone has no pre-attached specs, API returns no specs | Empty — "Specifications are not available yet." | ✅ |
| API returns 404 | Not Found — "Phone not found" | ✅ |
| API returns 500 | Error — "Unable to load specifications. Retry." | ✅ |
| API returns non-JSON response | Error — "Invalid response format" | ✅ |
| API request times out (8s) | Error — "Request timed out. Retry." | ✅ |
| Network error | Error — "Network error. Retry." | ✅ |
| User clicks Retry | Re-fetches specs | ✅ |
| User clicks eye rapidly | No duplicate requests (AbortController) | ✅ |
| User presses Escape | Dialog closes | ✅ |
| User presses Enter on eye button | Dialog opens | ✅ |

## Compare Page State Matrix

| Scenario | Expected | Status |
|----------|----------|--------|
| 0 phones, open picker | Dialog with search, "Browse Phones" CTA | ✅ |
| 1 phone, open picker | Dialog shows "Add at least one more" message | ✅ |
| 2+ phones, click Compare | Table with scores and specs | ✅ |
| 4 phones, try to add 5th | Disabled with message | ✅ |
| Remove phone during comparison | If < 2 phones, back to selection mode | ✅ |
| Clear All | All removed, URL updated | ✅ |
| Direct URL `/compare?p=a,b` | Both phones loaded and compared | ✅ |
| Invalid slug in URL | Ignored with remaining phones shown | ✅ |
| Browser Back/Forward | Restores selected phones from URL | ✅ |
| Category winner with all zeros | No winner shown ("No data") | ✅ |
| Category winner tie | Would mark all tied | ✅ (logic present) |

## Admin Phone Edit State Matrix

| Scenario | Expected | Status |
|----------|----------|--------|
| Edit phone with specs | Specs saved with proper types | ✅ |
| Edit phone without specs | Phone saves, no specs created | ✅ |
| Edit phone without images | Phone saves, no images deleted | ✅ |
| Edit phone without prices | Phone saves, no prices deleted | ✅ |
| Edit phone without benchmarks | Phone saves, no benchmarks created | ✅ |
| Edit phone with legacy data (missing new fields) | Phone saves, missing fields get defaults | ✅ |
| Double-click Save | Second click ignored | ✅ |
| Extra fields from client (e.g., `id`, `_count`) | Stripped before save | ✅ |
| Numeric spec field sent as string | Coerced to Number | ✅ |
| Duplicate slug | Returns 409 Conflict | ✅ |