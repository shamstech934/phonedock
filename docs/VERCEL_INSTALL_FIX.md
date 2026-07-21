# Vercel Install Fix

This release removes environment-specific npm registry URLs from `package-lock.json` and restores portable public npm registry URLs.

Changes:
- Removed `bun.lock` to avoid mixed package-manager detection.
- Removed custom Vercel install command so Vercel uses the lockfile normally.
- Requires Node.js 22.12 or newer within Node 22.
- Removed the pinned npm package manager override.
- Added public npm registry configuration in `.npmrc`.

Vercel deployment:
1. Push this project to GitHub.
2. In Vercel, use Node.js 22.x.
3. Keep Install Command on Default/blank.
4. Redeploy without build cache.
