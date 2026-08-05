PhoneDock Price Intelligence - Phase 2 PATCH
=============================================

IMPORTANT
---------
This is a small incremental patch, not a complete project ZIP.
It is made for the current PhoneDock project after the Phase 1 price-intelligence patch.

HOW TO INSTALL
--------------
1. Keep a backup of the current working project.
2. Open the local GitHub Desktop repository folder that contains package.json.
3. Open this PATCH ZIP and copy all its contents into that repository root.
4. Choose Replace files when Windows asks. Do not delete the project folder first.
5. Do not replace or delete .env files, public uploads, MongoDB data, or Vercel variables.
6. In GitHub Desktop, review the changed files, commit, and push to main.
7. Wait for Vercel deployment and then run one Price Tracker sync from admin.

WHAT THIS PATCH DOES
--------------------
- Compares all enabled, trusted and verified retailer offers for each phone.
- Keeps PTA and Non-PTA best prices separate.
- Selects the lowest compatible verified offer as the public canonical price.
- Respects an administrator-selected preferred price source when configured.
- Prevents untrusted, unavailable and pending-review prices from becoming public.
- Keeps suspicious large changes pending without overwriting the last verified price.
- Recomputes the best offer after approval, rejection, price changes, and unavailability.
- Stores best source/listing metadata and verified offer counts on Phone records.
- Preserves manual price lock behavior.
- Creates real discount and temporary price-drop trending state only from verified changes.

DATABASE
--------
No destructive migration is required. New Mongoose fields are additive and receive safe defaults.

VERIFICATION COMPLETED
----------------------
- npm run typecheck: PASS
- focused ESLint on all changed files: PASS (0 errors, 0 warnings)
- focused price-intelligence tests: PASS
- npm test: PASS
- npm run build: PASS

NOTE
----
Automatic tracking still requires genuine product pages or approved retailer feeds.
PhoneDock does not invent product URLs or prices. Only trusted and verified offers can affect public prices.
