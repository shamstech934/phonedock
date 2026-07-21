# PhoneDock v4.0

## Added

- Consolidated `/rankings` page for overall, gaming, camera, battery, value and budget categories.
- Reusable ranking engine with weighted scores and explicit data confidence.
- Missing score fields are ignored instead of treated as artificial zeroes.
- Budget ranking combines quality signals with Pakistan price positioning.
- Smart Rankings navigation entry.
- Automated ranking-engine test.

## Deployment

No new database migration or environment variable is required. Published phones need valid score fields to appear in rankings.
