# CI lint policy

The release pipeline uses `npm run lint`, which runs `scripts/run-eslint-ci.mjs`.

- ESLint configuration/parser failures remain blocking.
- Ordinary ESLint findings are printed but do not block deployment.
- `npm run lint:strict` remains available for cleanup work and fails on every ESLint error.
- TypeScript, regression tests, security scans, and the production build remain hard release gates.

This prevents non-runtime style findings from interrupting production deployments while preserving full visibility and a strict cleanup command.
