# Developer Guide

## Prerequisites

- Node.js `>=22.12.0 <23`
- npm with lockfile support
- MongoDB replica set for transaction-dependent workflows

## Setup

1. Copy `.env.example` to `.env.local` and replace placeholders.
2. Run `npm ci`.
3. Run `npm run env:check`.
4. Run `npm run dev`.

Never commit `.env*`, credentials or exported production data.

## Required quality checks

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and `npm run test:e2e`. Database integration tests require an isolated test database. Browser tests may start the configured Playwright web server.

## Change conventions

- Make small domain-focused changes.
- Add regression coverage for security, parsing and business-rule fixes.
- Reuse shared validation, logging and UI primitives.
- Do not silently swallow operational errors.
- Update `CHANGELOG.md` for user-visible or operational changes.
- Add a migration when persisted data shape or index behavior changes.

## Debugging

Use request IDs from response headers/logs to correlate failures. Use `npm run db:check` for database connectivity and `npm run env:check` for configuration. Never log JWTs, cookies, reset tokens, passwords, SMTP credentials or complete third-party payloads containing personal data.
