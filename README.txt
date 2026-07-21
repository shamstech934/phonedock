PhoneDock Rankings Vercel Build Hotfix

Fixes:
- Removes unsupported `fill` prop from SafePhoneImage usage.
- Uses explicit width={220} and height={128}, which SafePhoneImage supports.

Apply:
1. Copy the `src` folder into the project root.
2. Allow overwrite.
3. Commit/push to GitHub or redeploy on Vercel.

No environment variable or database migration is required.
