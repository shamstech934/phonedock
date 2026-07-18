# DEPLOYMENT VERIFICATION CHECKLIST
**Build:** PHONEDOCK-FIX-PERFORMANCE-15 | **Date:** 2026-07-18

## Pre-Deployment Checks ✅

- [x] TypeScript compiles with 0 errors
- [x] ESLint passes with 0 errors
- [x] `next build` completes successfully
- [x] No `scrollIntoView` / `window.scrollTo` in client code
- [x] No `href="#"` in client code
- [x] No service worker stale cache risk (no SW exists)
- [x] Single "Clear All" in Compare page
- [x] Dialog z-index (100) > Header z-index (50)
- [x] `SafePhoneImage` validates hosts
- [x] `PhoneQuickViewDialog` has session-level spec cache
- [x] All API response shapes handled (5 patterns)
- [x] Admin save handler has comprehensive error handling
- [x] xlsx/papaparse not in public bundle
- [x] Database indexes verified

## Post-Deployment Verification (Manual)

### Step 1: Build Marker
```
GET https://phonedock-pi.vercel.app/api/build-info
Expected: {"buildId":"PHONEDOCK-FIX-PERFORMANCE-15","commit":"<sha>","branch":"<branch>","environment":"production"}
```

### Step 2: Footer
- Open https://phonedock-pi.vercel.app
- Scroll to footer
- Verify: `Build: PHONEDOCK-FIX-PERFORMANCE-15` visible

### Step 3: Quick View
- Open homepage
- Scroll to "Latest Phones" section
- Click the eye (👁) icon on any phone card
- **Expected:** Modal dialog opens centered, above header
- **Expected:** Shows phone image, name, brand, price, PTA badge
- **Expected:** Shows specs rows OR "Specifications are not available yet." OR error with Retry
- **Expected:** Page/card height does NOT expand
- **Expected:** Escape closes dialog
- **Expected:** Backdrop click closes dialog
- **Expected:** Focus returns to eye button

### Step 4: Compare Add Phones
- Open /compare
- Click "Add Phones" button
- **Expected:** Modal dialog opens (NOT page scroll)
- **Expected:** scrollY does not change
- **Expected:** Search input is inside the modal
- **Expected:** Type 2+ characters → results appear
- **Expected:** Add a phone → it appears in selected chips
- **Expected:** "Done" button or auto-close when 2+ phones selected

### Step 5: Compare Table
- Compare 2 phones
- **Expected:** Missing specs show "Not available" (not blank)
- **Expected:** No `[object Object]` anywhere
- **Expected:** Only one "Clear All" button

### Step 6: Images
- Browse homepage and phone pages
- **Expected:** No broken image icons
- **Expected:** Smartphone fallback icon for phones without images
- **Expected:** No layout shift when images load

### Step 7: Performance
- Open Chrome DevTools → Lighthouse → Mobile
- Run on: homepage, /phones, /compare
- Target: Performance ≥ 90, LCP < 2.5s, CLS < 0.1

### Step 8: Hard Refresh / Incognito
- Open https://phonedock-pi.vercel.app in Incognito
- Verify build marker
- Test Quick View and Compare

## Deployment Commands

```bash
export NEXT_PUBLIC_BUILD_ID=PHONEDOCK-FIX-PERFORMANCE-15
npm run build
# Push to production branch or:
vercel --prod
```