# Price Range Exact Boundaries Fix

Version: 31.12.15

All public, admin, default-settings, and phone-filter labels now use exact non-overlapping boundaries:

- PKR 1–24,999
- PKR 25,000–49,999
- PKR 50,000–99,999
- PKR 100,000–149,999
- PKR 150,000–249,999
- PKR 250,000+

Existing saved homepage configurations using the same numeric boundaries are normalized to these canonical labels at runtime, so a database migration is not required.
