# Security Policy and Operations

## Controls

PhoneDock uses separate user/admin authentication paths, HTTP-only cookie sessions, server-side authorization, rate limiting, session revocation/versioning, input validation, security headers, URL allowlists and structured security events. Analytics and advertising require consent.

## Secret handling

Use independent, randomly generated JWT secrets. Store secrets in the deployment platform, never source control. Rotate JWT, cron, SMTP, Turnstile, Cloudinary, setup and affiliate credentials after exposure. Public-prefixed variables must never contain secrets.

## High-risk surfaces

Admin bootstrap, cron, collectors, imports, uploads, affiliate redirects and remote media ingestion require explicit authorization and validation. Remote fetches must reject private/link-local addresses and redirects to disallowed hosts. Uploads require type, size and destination restrictions.

## Vulnerability response

Do not disclose vulnerabilities in public issues. Record affected release, reproduction, severity and exposure; contain access; preserve evidence; rotate secrets/revoke sessions; patch with regression coverage; deploy; and review logs. Avoid sensitive values in tickets and logs.

## Release verification

Review cookies, JWT lifetimes, RBAC, CSRF assumptions, rate-limit backing store, headers, environment validation, dependencies and logs. Automated tests reduce risk but do not replace an independent penetration test for a public commercial launch.
