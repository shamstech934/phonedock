# PhoneDock v19.0.0 — Audit Report

**Method:** Static code audit (no internet access in the audit sandbox — could not run
`npm install`, `next build`, `tsc`, or connect to live MongoDB). Every fix below was
verified by reading the actual code path end-to-end (frontend call → route matcher →
handler → model/DB query), not by guessing. Nothing here was rewritten "for style" —
only confirmed bugs were touched, per the "bugs, not features" instruction.

**⚠️ Before deploying:** run these yourself, since they need network/DB access this
sandbox didn't have:
```
npm install
npm run lint
npm run typecheck
npm run build
npm run test
```

---

## Fixed in this pass

### 1. Data Quality → "Fix All" only ever touched 50 issues (your reported bug — confirmed root cause)
**Files:** `src/app/admin/data-quality/page.tsx`, `src/app/api/[[...path]]/handlers/data-quality.ts`

Root cause: the Issues list fetched `limit: '50'` per page, and "Select All" only ever
selected `issues.map(i => i.id)` — i.e. the 50 rows currently on screen. There was no
button anywhere that touched the full filtered queue.

Fix:
- New backend route `POST /api/admin/data-quality/fix-all` — fixes every **open,
  auto-fixable** issue matching the current filters (severity/type/entity/search),
  server-side, in one call (capped at 2,000 per call to avoid request timeouts —
  call it again if a queue is bigger than that).
- New "Fix All (N)" button in the toolbar, showing the real total count, not the page size.
- Confirmation prompt before running (it's a bulk write).

### 2. "Auto-Fix" existed in the backend but had **no button anywhere in the admin UI**
**Files:** same as above

`executeAutoFix()` and the `/issues/:id/fix` and `/bulk-fix` (`action: 'fix'`) endpoints
were fully implemented and worked — but the Issues tab only ever offered **Resolve** and
**Ignore**. The bulk-action dropdown never listed "fix", and no row had a Fix button.
Net effect: the 3 rules that support real auto-fix were completely unreachable from the UI.

Fix:
- API now returns `canAutoFix: true/false` per issue (looked up against the actual rule).
- A wrench "Auto-fix" button now shows on any row where `canAutoFix` is true.
- Bulk-action dropdown now includes "Auto-fix" (already supported server-side, just never exposed).

### 3. `SPECS_DUPLICATE` rule was declared `canAutoFix: true` but was dead code
**File:** `src/lib/data-quality/rules/phone-rules.ts`

- `detect()` built a `seen` map and then **never used it** — always returned `[]`.
  This rule never flagged a single issue, ever, regardless of real duplicate data.
- `autoFix()` unconditionally returned `{ success: false, error: 'Manual review required' }`
  — so even if an issue had existed, clicking fix would always fail.

Fix: implemented real detection (aggregates `PhoneSpecs` by `phoneId`, flags any phone with
more than one specs document) and a real, safe auto-fix (keeps the most recently updated
document, deletes the rest — `dryRun` respected, no destructive action on preview).

---

## Found, NOT changed — needs your decision

### `/admin/import-v2` exists, is more capable, but is unreachable
**Files:** `src/app/admin/import-v2/page.tsx` (1,641 lines) vs `src/app/admin/import/page.tsx` (531 lines)

The sidebar nav (`src/app/admin/layout.tsx`) only links to `/admin/import`. There's a
second, larger import system at `/admin/import-v2` with its own handler
(`handlers/import-v2.ts`, 690 lines: batch processing, retry, cancel, rollback, quality
scan, validate) that is **not linked anywhere** in the admin UI — you can only reach it by
typing the URL directly.

I didn't wire this in myself because:
- I can't run it live here to confirm it's actually finished/working (no DB/network).
- Silently switching your primary import system is a functional change, not a pure bug
  fix — I'd rather you say which one is meant to be current.

**Your call:** (a) it's finished — add it to the nav and retire the old one, (b) it's
abandoned WIP — I should leave it alone or delete it, or (c) you want me to diff the two
and merge the useful bits into the one that's live. Tell me and I'll do it as the next pass.

---

## Scope covered vs. not, honestly

Given this is a 393-file, 24-model, 20+ admin-page project and this sandbox has no
network access, I went **deep** on Data Quality (your explicitly reported bug) and did a
**structural pass** (route-matcher ↔ handler ↔ frontend fetch-call consistency checks) on
Import. The other phases (Analytics, Users, Settings, Sync, Collector, Sponsors, Videos,
Reviews, Production/build/SEO) were not yet audited in this pass — I'd rather tell you
that plainly than claim a 6-phase certification I can't actually back up without running
the app.

If you want, next pass I'll go phase-by-phase through the rest with the same standard:
real root-cause, real fix, no rewrite unless something is actually broken.

---

## Added after initial pass — reported via screenshots

### Settings page: title + "Save All" button invisible on scroll
**File:** `src/app/admin/settings/page.tsx`

Root cause: the page's own header (`Website CMS & Settings` title + Save All button)
used `sticky top-0 z-20`. The admin shell's top navbar is *also* `sticky top-0` but
`z-50` and 56px (`h-14`) tall. Since both stick to the exact same y-position, the
higher-stacked navbar rendered on top of and completely hid the settings header the
moment you scrolled — so the Save button was never reachable without scrolling all the
way back to the very top. That's why the page looked stripped-down/incomplete in the
screenshots — the content was all there (Hero, Announcement Bar, 15 homepage sections,
Branding, SEO, Social, Footer, Floating 3D Phones, Maintenance Mode), the header just
wasn't.

Fix: changed to `sticky top-14`, matching the same offset the sidebar already uses
correctly (`src/app/admin/layout.tsx` line 191), so it now sticks right below the navbar
instead of behind it.

Checked whether this same bug existed elsewhere (`grep sticky top-0` across
`src/app/admin`): found 3 more matches in Users, Data Quality, and Import — but all three
are headers inside their own modal/drawer/table scroll containers (`overflow-y-auto`
locally), where `top-0` is correct. Settings was the only page-level instance.
