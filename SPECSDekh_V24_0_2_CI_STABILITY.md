# SpecsDekh v24.0.2 — Long-Term CI Stability Fix

## Root cause
The release gate regression test asserted dependency-private paths such as
`typescript/bin/tsc`. Those paths are implementation details and may change
between npm, package versions, operating systems, and module export policies.
The runtime doctor itself had already moved to the stable `package.json#bin`
contract, but the old source-text test still expected obsolete paths.

## Permanent fix
- Replaced private-path assertions with behavior-based checks.
- The test now validates the public package manifest `bin` contract.
- The actual runtime doctor is executed and must exit successfully.
- Node 22 and Node 24 remain supported without forcing one exact major in all files.
- npm remains semver-pinned for reproducible installs.
- Recovery instructions continue to require `npm ci --include=dev`.

This avoids coupling CI to dependency folder layouts and is portable across
GitHub Actions, Vercel, Linux, Windows, npm updates, and future package releases.
