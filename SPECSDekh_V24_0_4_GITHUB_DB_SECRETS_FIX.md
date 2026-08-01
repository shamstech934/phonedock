# SpecsDekh v24.0.4 — GitHub Database Secrets Fix

## Fixed

The GitHub Release Gate production build previously did not receive repository secrets, so Next.js prerendering failed with:

`MONGODB_URI environment variable is not defined (legacy MONGO_URL is also supported)`

The release workflow now injects these GitHub Actions repository secrets into the production build:

- `MONGODB_URI`
- `MONGO_URL` (legacy fallback)
- `DB_NAME`

A clear preflight step now fails with an actionable message when the required secrets are missing, instead of failing later during Next.js prerendering.

## Required GitHub repository secrets

- `MONGODB_URI` = MongoDB Atlas connection string
- `MONGO_URL` = same connection string (backward compatibility)
- `DB_NAME` = `phonedock`

No secret value is committed to the repository.
