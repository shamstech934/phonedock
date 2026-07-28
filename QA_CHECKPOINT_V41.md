# PhoneDock v41 QA checkpoint

## Confirmed production findings

- MongoDB TLS failures caused repeated build retries and slow public API
  responses.
- `/phones` and `/videos` could leave visitors on loading UI without useful
  failure feedback.
- The rankings metadata included `PhoneDock` even though the root layout already
  adds the site suffix.
- The buying-assistant quick-prompt handler started with `use`, so ESLint treated
  it as a React hook called from a callback.
- Homepage data currently includes large numbers of raw regional variants and
  many price-unavailable records. This requires a separate publication/data
  quality policy; records were not silently deleted or altered in this hotfix.

## Implemented

- Serverless-safe MongoDB retry, timeout, cooldown, and pool behavior.
- Safe 503 classification for MongoDB TLS and selection failures.
- Explicit timeout, error message, and retry UI for phones and videos.
- Graceful initial `/phones` server-render fallback.
- Buying-assistant hook-rule fix.
- Rankings title suffix fix.

## Verification

- Targeted ESLint for all changed files: pass.
- TypeScript checks for all changed files: pass.
- Full lint originally reported 1 error and 167 warnings; the blocking error is
  fixed. The warnings remain technical debt.
- Full typecheck is blocked in the supplied local dependency installation
  because `exceljs`, `jszip`, and `sanitize-html` are declared but not installed.
- `npm test` is blocked because the supplied local installation has no `tsx`
  executable.

Run a clean `npm ci` under the Node version specified by `.nvmrc`, then rerun
typecheck, lint, tests, and build before production promotion.
