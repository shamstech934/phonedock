
## Verification status in this environment

- Node.js: v22.16.0 (required major version confirmed).
- The previous Vercel deployment compiled and type-checked after Build Fix 3, as confirmed by the user.
- A fresh dependency installation was attempted here but exceeded the execution time limit, so `npm run lint`, `npm run build`, `npm test`, and Playwright were not re-claimed as passing for this final documentation/environment cleanup package.
- Private Vercel environment values cannot be read from this ZIP. Run `npm run env:check` in Vercel/CI after setting the variables.

## Go / no-go

Conditional **GO** after the deployment environment passes `npm run env:check` and the new Vercel build is green. Remove `NEXT_PUBLIC_SITE_URL` and `COLLECTOR_SECRET`; remove `FIRST_ADMIN_SETUP_KEY` immediately after first-admin setup.
