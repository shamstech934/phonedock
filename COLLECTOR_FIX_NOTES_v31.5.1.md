# Collector Fix v31.5.1

- Removed duplicate `checksum` and `lastVerifiedAt` schema fields from `CollectedPhone`.
- Hardened collector HTTP header normalization for Mongoose Maps, native Maps, Headers, and plain objects.
- Non-scalar, empty, or newline-containing header values are ignored instead of being passed to `fetch`.
- Applied the same safe conversion to collector source and job provider config builders.
- Preserved Samsung/manual URL parsing and source provenance.
