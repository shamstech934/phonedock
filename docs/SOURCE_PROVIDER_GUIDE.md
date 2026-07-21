# Source provider guide

Providers extend `BaseProvider` and return `ProviderFetchResult` containing normalized phones, pagination state and safe errors. Reuse `mapExternalRecord` for nested mappings and defaults. All remote requests pass SSRF validation, reject redirects/private networks, enforce timeout and response-size limits, and inject secrets only from named environment variables.

An approved manufacturer adapter should subclass `BaseProvider`, validate vendor configuration, implement pagination/checkpoints, register one explicit type in the provider factory, and add contract/security tests. Do not modify the core runner or enable the generic manufacturer provider; it intentionally fails closed.
