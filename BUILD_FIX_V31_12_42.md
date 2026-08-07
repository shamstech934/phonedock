# v31.12.42 Build Fix
- Restored missing `CheckboxInput` import in `BasicInfoSection.tsx`.
- This fixes the Vercel TypeScript error: `Cannot find name 'CheckboxInput'` at line 119.
- Package version bumped to 31.12.42.
- Local dependency installation was attempted, but the execution environment's npm mirror returned 404 for `zod-validation-error@4.0.2`; therefore a full local Next.js build could not be truthfully certified here.
