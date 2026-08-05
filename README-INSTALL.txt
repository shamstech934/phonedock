PhoneDock Price Intelligence Phase 1 - Safe PATCH

SOURCE BASELINE
phonedock-main (12).zip / specsdekh 31.12.20

INSTALL
1. Extract this PATCH ZIP.
2. Open your current PhoneDock project folder (the folder containing package.json).
3. Copy everything from this extracted PATCH folder into that project folder.
4. Choose Replace when Windows asks about existing files.
5. Do not delete your .env files, database, public uploads, or any other project files.
6. Commit and push the resulting five changed/added project files.

WHAT THIS PATCH DOES
- Converts verified automatic price changes into the canonical phone price state.
- Preserves a genuine previous verified higher price for discount display.
- Never invents an original price or discount.
- Blocks explicitly conflicting PTA and Non-PTA listing updates for admin review.
- Marks verified price drops of 5 percent or more as Trending for seven days.
- Automatically removes only expired price-drop trending flags.
- Preserves manually managed Trending state.

FILES
- package.json
- scripts/__tests__/price-tracker-intelligence.test.ts
- src/lib/price-tracker-intelligence.ts
- src/lib/models/Phone.ts
- src/app/api/[[...path]]/handlers/cron-update-prices.ts

VERIFIED
- TypeScript: passed
- Focused ESLint: passed
- Full npm test: passed
- Production build: passed

NOTE
The build was run without a local MONGODB_URI. The existing homepage fallback logged that
missing local variable during prerender, but the build completed successfully. Vercel must
continue to hold the real MONGODB_URI and CRON_SECRET values.
