# SpecsDekh v30.3 — Dashboard Automation QA Fix

## Implemented

- Import Engine card now exposes Created, Updated, Replaced, Skipped, Failed, current batch and total batch data from the real ImportJob record.
- Monitoring now distinguishes records scanned from successfully completed scans. A completed scan with zero discoveries no longer displays `0 Success`.
- Price Tracker shows real linked-phone coverage, the reason it cannot run, and a direct configuration action.
- Collector shows an explicit not-run/configuration reason when no CollectorJob exists, rather than an unexplained blank status.
- Recent Activity removes duplicate repeated events before rendering.
- Missing gallery health card now includes a direct queue action.
- Automation metric labels are module-specific instead of misleading generic labels.

## Safety

- No AI integration was added.
- No database data is automatically changed by the dashboard.
- Dashboard values remain sourced from MongoDB job and phone records.
