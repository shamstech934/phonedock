# SpecsDekh v31.9.2 TypeScript Hotfix

Fixed the CI/Vercel error in `src/app/admin/phones/page.tsx` where CSV export referenced `phone.brandName` but the shared `Phone` type did not expose that compatibility field.

Changes:
- Added optional `brandName` and `model` compatibility aliases to the shared `Phone` interface.
- CSV export now prefers populated `phone.brand.name`, then falls back to `phone.brandName`.
- Model export prefers `modelName`, then falls back to `model`.

This keeps current API payloads and older admin payload shapes compatible without weakening the rest of the type.
