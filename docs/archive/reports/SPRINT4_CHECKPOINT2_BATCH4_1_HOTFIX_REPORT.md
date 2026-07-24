# Sprint 4 – Checkpoint 2, Batch 4.1 Hotfix

## Build failure fixed

Vercel failed while prerendering `/` with:

`Functions cannot be passed directly to Client Components`

## Root cause

`SectionHeader` was marked with `use client`, while the server-rendered homepage passed Lucide icon components to its `icon` prop. React Server Components cannot serialize component functions across a server-to-client boundary.

## Fix

Removed the unnecessary `use client` directive from:

- `src/components/shared/SectionHeader.tsx`

`SectionHeader` does not use state, effects, browser APIs, or event handlers, so it can safely remain a shared/server-compatible component. Client components can still import and render it normally.

## Verification

- `npm ci` completed successfully.
- Next.js production compilation completed successfully.
- `npx tsc --noEmit` passed with zero TypeScript errors.
- The original homepage server-to-client function serialization boundary has been removed.

## Unrelated warnings

- Next.js reports that the `middleware` convention is deprecated in favor of `proxy`.
- npm reports dependency audit findings. Neither warning caused this deployment failure.
