# Accessibility & Responsiveness Audit — PhoneDock Pakistan

**Date:** 2025-07-09  
**Scope:** Core layouts, public pages, and key shared components  
**Auditor:** Automated code review (read-only)

---

## Executive Summary

| Severity | Count | Categories |
|----------|-------|------------|
| **Critical** | 2 | Missing skip-to-content link; custom modal without focus trap / escape-to-close |
| **High** | 8 | Missing `aria-label` on icon-only buttons; form inputs without programmatic labels; heading hierarchy skip; custom dropdown missing ARIA roles; tiny touch targets; text below readable size |
| **Medium** | 10 | Color contrast (muted-foreground on light bg); `no-scrollbar` hiding scroll indicators; missing `role` attributes; duplicate checkbox labels; breadcrumb not using `<nav>` |
| **Low** | 4 | `lang="en"` should be `lang="en-PK"`; video iframe missing `aria-label`; minor heading nesting in sections |

**Total issues found: 24**

---

## Accessibility Issues (a11y)

### A11Y-01 — Missing Skip-to-Content Link
- **File:** `/home/z/my-project/src/app/layout.tsx`, line 113
- **Severity:** Critical
- **Description:** No skip-to-content link exists anywhere in the root layout or any child component. Keyboard users must tab through the entire header navigation before reaching the main content on every page.
- **Suggested Fix:** Add `<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 ...">Skip to content</a>` as the first element inside `<body>`, and add `id="main-content"` to each page's `<main>` element.

---

### A11Y-02 — Admin Password Modal Missing Dialog A11y
- **File:** `/home/z/my-project/src/app/admin/layout.tsx`, lines 262–278
- **Severity:** Critical
- **Description:** The "Change Password" modal is a plain `<div>` with `className="fixed inset-0 bg-black/50 ..."`. It is missing:
  - `role="dialog"` and `aria-modal="true"` on the dialog container
  - `aria-label` or `aria-labelledby` to identify the dialog
  - A focus trap (focus can escape to the page behind)
  - Escape key handling to close the dialog
  - Focus is not moved to the first input when the modal opens
- **Suggested Fix:** Replace the custom modal with a `<Dialog>` component from `@/components/ui/dialog` (Radix-based, which handles focus trap, escape key, and `aria-modal`), or add all missing ARIA attributes and keyboard event handlers manually.

---

### A11Y-03 — Icon-Only "Compare" Link Missing `aria-label` in PhoneCard
- **File:** `/home/z/my-project/src/components/shared/PhoneCard.tsx`, lines 355–362 and 237–244
- **Severity:** High
- **Description:** The Compare button (a `<Link>` containing only a `GitCompare` icon) has a `title="Compare"` attribute but no `aria-label`. The `title` attribute is not reliably announced by screen readers.
- **Suggested Fix:** Add `aria-label="Compare {phone.modelName}"` to both Compare links (card action row at line 358, and Quick View dialog at line 241).

---

### A11Y-04 — Review Form Star Rating Buttons Missing `aria-label`
- **File:** `/home/z/my-project/src/app/phones/[slug]/page.tsx`, lines 306–309
- **Severity:** High
- **Description:** The five star rating buttons use `<Star>` icons with no accessible label. Screen readers will announce them as generic "button" elements. The group also lacks `role="radiogroup"` and `aria-checked` state.
- **Suggested Fix:**
  ```tsx
  <div role="radiogroup" aria-label="Rating">
    {[1,2,3,4,5].map(i => (
      <button key={i} type="button" onClick={() => setFormRating(i)}
        role="radio" aria-checked={i <= formRating}
        aria-label={`${i} star${i > 1 ? 's' : ''}`}
        className="p-0.5">
        ...
      </button>
    ))}
  </div>
  ```

---

### A11Y-05 — Phone Detail Image Gallery Buttons Missing `aria-label`
- **File:** `/home/z/my-project/src/app/phones/[slug]/page.tsx`, line 519
- **Severity:** High
- **Description:** Thumbnail gallery buttons (`<button>`) have no `aria-label` or accessible name. Screen readers cannot identify what each button does.
- **Suggested Fix:** Add `aria-label={`View image ${i + 1} of ${images.length}`}` and `aria-pressed={i === activeImage}` to each thumbnail button.

---

### A11Y-06 — Compare Picker Dialog Search Input Missing `aria-label`
- **File:** `/home/z/my-project/src/app/compare/page.tsx`, line 318–323
- **Severity:** High
- **Description:** The search input inside the phone picker dialog has a placeholder but no `aria-label`. This is inside a dialog where the surrounding context might not provide enough information.
- **Suggested Fix:** Add `aria-label="Search phones to compare"` to the `<input>` element.

---

### A11Y-07 — "More" Navigation Dropdown Missing ARIA Roles & Keyboard Nav
- **File:** `/home/z/my-project/src/components/shared/Header.tsx`, lines 136–154
- **Severity:** High
- **Description:** The "More" dropdown is a plain `<div>` with no `role="menu"`, no `aria-expanded` on the trigger button, and no `role="menuitem"` on items. Keyboard users cannot navigate the dropdown with arrow keys or open it with Enter/Space. The dropdown also does not close when Escape is pressed or when focus leaves it.
- **Suggested Fix:** Use a Radix `DropdownMenu` component (already available in the project), or add `role="menu"`, `aria-expanded`, and keyboard navigation handlers manually.

---

### A11Y-08 — Mobile Menu Missing ARIA Attributes & Focus Trap
- **File:** `/home/z/my-project/src/components/shared/Header.tsx`, lines 274–306
- **Severity:** High
- **Description:** The mobile navigation menu is a plain `<div>` that appears when `mobileOpen` is true. It lacks:
  - `role="navigation"` with an `aria-label`
  - `aria-expanded` on the hamburger/close button (already has `aria-label` ✓)
  - A focus trap — Tab key can move focus behind the menu
  - Escape key to close
- **Suggested Fix:** Add `role="navigation" aria-label="Main navigation"` to the mobile menu container, `aria-expanded={mobileOpen}` to the trigger button, and a focus trap with Escape key handling.

---

### A11Y-09 — Breadcrumb Not Using Semantic `<nav>` Element
- **File:** `/home/z/my-project/src/app/phones/[slug]/page.tsx`, lines 487–493
- **Severity:** Medium
- **Description:** The breadcrumb trail is a plain `<div>` instead of a `<nav>` element with `aria-label="Breadcrumb"`. Screen readers rely on the `<nav>` landmark to identify breadcrumb navigation.
- **Suggested Fix:** Change the `<div>` to `<nav aria-label="Breadcrumb">` and wrap the list in an `<ol>`.

---

### A11Y-10 — Color Contrast: `text-muted-foreground` (#64748B) on Light Backgrounds
- **File:** Multiple files (PhoneCard.tsx, search/page.tsx, phones/[slug]/page.tsx)
- **Severity:** Medium
- **Description:** The CSS variable `--muted-foreground: #64748B` (Slate 500) is used extensively for secondary text on backgrounds like `#F8FAFC` and `#FFFFFF`. Contrast ratio:
  - `#64748B` on `#FFFFFF` ≈ **4.57:1** — passes AA (barely)
  - `#64748B` on `#F8FAFC` ≈ **4.28:1** — **fails AA** for normal text
  - `#64748B` on `#F1F5F9` (card surface) ≈ **4.04:1** — **fails AA** for normal text
  
  Many uses are `text-[10px]` or `text-[11px]` (below 14px), and the combination of small size + low contrast makes text hard to read for low-vision users.
  - **Key offenders:** PhoneCard spec tags (lines 176–178, 319–339), phone detail breadcrumb (line 487), "10px" secondary text throughout
- **Suggested Fix:** Darken `--muted-foreground` to `#475569` (Slate 600, contrast ≈ 6.04:1 on white) or at minimum `#546478` (contrast ≈ 4.76:1 on `#F1F5F9`).

---

### A11Y-11 — Contact Form Labels Not Programmatically Associated
- **File:** `/home/z/my-project/src/app/contact/page.tsx`, lines 100–108
- **Severity:** Medium
- **Description:** While the contact form does have visible `<label>` elements, they use `className` styling only and do not have `htmlFor`/`id` attributes linking them to their inputs. This means clicking the label does not focus the input, and screen readers may not correctly associate the label with the field.
- **Suggested Fix:** Add `id="name"` to the name input and `htmlFor="name"` to the label. Repeat for email, subject, and message fields.

---

### A11Y-12 — Review Form Inputs Use `aria-label` Instead of `<label>` Elements
- **File:** `/home/z/my-project/src/app/phones/[slug]/page.tsx`, lines 301–312
- **Severity:** Medium
- **Description:** The review form inputs use `aria-label` and `placeholder` attributes but no visible `<label>` elements. Visible labels improve usability for all users. The `aria-label` is present (✓), so this is a usability preference rather than a failure.
- **Suggested Fix:** Add proper `<label htmlFor="...">` elements above each input and keep the `aria-label` as a fallback.

---

### A11Y-13 — `no-scrollbar` CSS Class Hides Scroll Indicators
- **File:** `/home/z/my-project/src/app/globals.css`, lines 392–393; used in Header.tsx:241, PhoneCard images, phone detail images, HomeContent
- **Severity:** Medium
- **Description:** The `.no-scrollbar` class hides all scrollbar visual indicators. Users who rely on scrollbars to discover that content extends beyond the visible area (e.g., mobile tab bars, image galleries, brand carousels) will not know the content is scrollable. This affects:
  - Admin mobile tab navigation (`admin/layout.tsx:241`)
  - Image gallery thumbnails (`phones/[slug]/page.tsx:517`)
  - Header popular searches area
- **Suggested Fix:** Consider using thin/overlay scrollbars instead of fully hiding them, or add visible "scroll" affordances (e.g., fade edges, scroll indicator dots).

---

### A11Y-14 — Duplicate "Only Differences" Checkboxes on Compare Page
- **File:** `/home/z/my-project/src/app/compare/page.tsx`, lines 488–491 and 527–529
- **Severity:** Medium
- **Description:** Two identical checkboxes labeled "Only show differences" / "Only differences" appear in the Score Comparison and Specifications Comparison sections. Both control the same `onlyDifferences` state. Screen readers may announce these as separate unrelated controls, causing confusion.
- **Suggested Fix:** Use a single toggle at the top of the comparison area, or if two are needed, add `aria-describedby` pointing to the same description, and ensure both have the same `id`-linked label.

---

### A11Y-15 — SVG Charts Missing Accessible Descriptions
- **File:** `/home/z/my-project/src/app/phones/[slug]/page.tsx`, lines 46–71 (PriceHistoryChart) and 114–155 (PriceTrackerChart)
- **Severity:** Medium
- **Description:** The SVG charts use `<text>` elements for axis labels but have no `<title>`, `<desc>`, or `role="img"` / `aria-label`. Screen readers cannot determine what the chart represents.
- **Suggested Fix:** Add `<title>` and `<desc>` elements inside each SVG:
  ```tsx
  <title>Price history chart</title>
  <desc>Price from {minP} to {maxP} PKR over {points.length} data points</desc>
  ```
  Add `role="img"` and `aria-labelledby` to the `<svg>` element.

---

### A11Y-16 — `lang="en"` Should Be `lang="en-PK"`
- **File:** `/home/z/my-project/src/app/layout.tsx`, line 103
- **Severity:** Low
- **Description:** The `<html>` element has `lang="en"`, but the site is specifically targeted at Pakistan (phonedock.pk, PKR pricing, PTA status). The `en-PK` locale is already used in `openGraph.locale` and date formatting. Using `lang="en-PK"` would help screen readers use the correct pronunciation.
- **Suggested Fix:** Change `lang="en"` to `lang="en-PK"`.

---

### A11Y-17 — Video iframes Missing `aria-label`
- **File:** `/home/z/my-project/src/app/phones/[slug]/page.tsx`, lines 754–761
- **Severity:** Low
- **Description:** YouTube embed iframes have a `title` attribute (✓) but no `aria-label`. The `title` is present and sufficient for most screen readers, but adding `aria-label` with a more descriptive label (e.g., "Video review: {video title}") would be better.
- **Suggested Fix:** Add `aria-label={`Video review: ${v.title}`}` to the `<iframe>`.

---

### A11Y-18 — Heading Hierarchy Skip in Compare Page
- **File:** `/home/z/my-project/src/app/compare/page.tsx`, line 425
- **Severity:** Low
- **Description:** The empty state section uses an `<h3>` ("Select phones to compare") immediately after the page `<h1>` ("Compare Phones"), skipping `<h2>`. While WCAG allows skipping levels in some contexts, it can confuse screen reader users who rely on heading navigation.
- **Suggested Fix:** Change the `<h3>` on line 425 to `<h2>`.

---

## Responsiveness Issues

### R-01 — Touch Targets Too Small (36×36px) on PhoneCard Action Buttons
- **File:** `/home/z/my-project/src/components/shared/PhoneCard.tsx`, lines 358, 371
- **Severity:** High
- **Description:** The Compare (`w-9 h-9` = 36×36px) and Quick View (`w-9 h-9` = 36×36px) icon-only buttons are below the WCAG 2.5.5 minimum touch target size of 44×44px. On mobile devices, users with motor impairments will struggle to tap these accurately.
- **Suggested Fix:** Increase to `w-11 h-11` (44×44px) or add padding to achieve a minimum 44×44px touch target while keeping the visual icon at 36×36px.

---

### R-02 — Extremely Small Touch Targets in Compare Phone Picker
- **File:** `/home/z/my-project/src/app/compare/page.tsx`, lines 291, 337
- **Severity:** High
- **Description:** Remove buttons for selected phones are dangerously small:
  - Line 291: `w-5 h-5` = **20×20px** (in the top management bar)
  - Line 337: `w-4 h-4` = **16×16px** (inside the dialog picker)
  
  These are far below the 44×44px minimum and extremely difficult to tap on mobile.
- **Suggested Fix:** Apply `min-w-[44px] min-h-[44px]` to both buttons, centering the icon within the larger hit area. Use negative margins or absolute positioning to maintain visual alignment.

---

### R-03 — Text Below Readable Size (10px, 9px) on Mobile
- **File:** Multiple files, extensively
  - `PhoneCard.tsx`: lines 169, 176–178, 282, 287, 292, 297, 308, 315, 319–339
  - `Header.tsx`: lines 210, 226, 236, 253
  - `phones/[slug]/page.tsx`: lines 531, 545, 549, 562, 571, 575, 625, 637, 641, 657, 665, 721
  - `search/page.tsx`: line 122
  - `contact/page.tsx`: line 73
  - `admin/layout.tsx`: lines 182, 203, 248
- **Severity:** High
- **Description:** Pervasive use of `text-[10px]` (10px) and `text-[9px]` (9px) for labels, badges, metadata, and secondary text. WCAG 1.4.12 (Text Reflow) and general readability guidelines recommend a minimum of 14px for body text. While 10px is technically permissible for non-essential labels, the sheer volume means important information (phone specs, prices, PTA status, store names) is often presented at these tiny sizes. On high-DPI mobile devices, 10px text can be particularly difficult to read.
- **Suggested Fix:**
  - Replace `text-[10px]` with `text-[11px]` minimum for metadata
  - Replace `text-[9px]` with `text-[10px]` minimum
  - Consider using `text-xs` (12px) for spec tags in PhoneCard
  - Ensure all essential price/information text is at least `text-xs` (12px)

---

### R-04 — Compare Page Table May Overflow Without Clear Scroll Indication
- **File:** `/home/z/my-project/src/app/compare/page.tsx`, lines 532–587
- **Severity:** Medium
- **Description:** The specifications comparison table has `overflow-x-auto` and `min-w-[500px]`, which is correct. However, there is no visual indication (arrow, shadow, or "scroll to see more" hint) that the table is horizontally scrollable on mobile. Combined with the `.no-scrollbar` pattern used elsewhere in the codebase, users may not realize content extends beyond the viewport.
- **Suggested Fix:** Add a CSS gradient fade on the right edge of the scroll container to indicate more content, or add a visible scrollbar on mobile. Ensure the table does NOT use the `no-scrollbar` class.

---

### R-05 — Admin Mobile Tab Bar Overflow Without Scroll Indication
- **File:** `/home/z/my-project/src/app/admin/layout.tsx`, line 241
- **Severity:** Medium
- **Description:** The admin mobile navigation uses `overflow-x-auto` with `no-scrollbar`, showing a horizontally scrollable tab bar. With 14+ nav items, many tabs will be hidden off-screen with no visual affordance that scrolling is possible.
- **Suggested Fix:** Add gradient fade indicators on left/right edges, or use a "More" overflow pattern. Remove `no-scrollbar` and use thin custom scrollbars.

---

### R-06 — SVG Price Charts Use Fixed Pixel Dimensions
- **File:** `/home/z/my-project/src/app/phones/[slug]/page.tsx`, lines 32–33 and 85
- **Severity:** Low
- **Description:** The `PriceHistoryChart` uses fixed `w = 280, h = 120` and `PriceTrackerChart` uses `w = 600, h = 200`. While the SVGs use `preserveAspectRatio="xMidYMid meet"` and have responsive wrapper classes, the PriceTrackerChart at 600px wide may render very small text (8–9px font sizes in SVG) when compressed to mobile widths. The axis labels at `fontSize="7"` and `fontSize="8"` will become illegibly small on narrow screens.
- **Suggested Fix:** Consider making the chart height responsive or switching to a simpler stat-based layout on mobile instead of a full chart.

---

## Positive Findings (What's Done Well)

| Area | Details |
|------|---------|
| **`<html lang>`** | Present on root layout (line 103) ✓ |
| **Viewport meta** | Correctly configured with `width: device-width, initial-scale: 1` ✓ |
| **Image alt text** | All `<Image>` components have proper `alt` attributes using `phone.modelName` or `p.brand.name` ✓ |
| **Dialog component** | PhoneCard Quick View and Compare Picker use Radix `Dialog` with proper `DialogTitle`, `DialogDescription`, focus management ✓ |
| **Header icon buttons** | Search, theme toggle, and hamburger buttons all have `aria-label` ✓ |
| **Quick View button** | Has `aria-label`, `aria-expanded`, and `aria-haspopup="dialog"` ✓ |
| **Phone detail h1** | Uses `sr-only` h1 for SEO while displaying h2 visually — acceptable pattern ✓ |
| **Remove phone buttons (compare)** | Have `aria-label` with phone name ✓ |
| **Add/Clear buttons (compare)** | Have `aria-label` ✓ |
| **Form focus indicators** | Contact form and other inputs have `focus:ring` styles ✓ |
| **Responsive grid** | PhoneCard grids use `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` ✓ |
| **Phone detail responsive** | Uses `grid-cols-1 lg:grid-cols-3` for proper mobile-first layout ✓ |

---

## Priority Remediation Order

1. **Immediate (Critical):** Add skip-to-content link (A11Y-01); Replace admin password modal with accessible Dialog (A11Y-02)
2. **Short-term (High):** Add `aria-label` to all icon-only buttons (A11Y-03, 05, 06); Fix star rating a11y (A11Y-04); Fix "More" dropdown and mobile menu (A11Y-07, 08); Enlarge touch targets (R-01, R-02)
3. **Medium-term (Medium):** Fix muted-foreground contrast (A11Y-10); Associate form labels properly (A11Y-11); Address tiny text sizes (R-03); Fix scroll indicator issues (R-04, R-05)
4. **Low-priority (Low):** Update `lang` attribute (A11Y-16); Fix heading skip (A11Y-18); Add SVG descriptions (A11Y-15)