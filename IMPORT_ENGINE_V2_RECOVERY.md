# SpecsDekh Import Engine V2 Recovery

This release adds a safe **Repair & Reconcile** action in Admin → Import V2 → History.

It performs the following without deleting phone records:

- Recalculates job counters from completed batches.
- Converts stale abandoned jobs to `failed` instead of `cancelled`.
- Removes orphan import-batch tracking rows.
- Reactivates imported phone records hidden by legacy `active/deletedAt` values.
- Publishes only imported drafts that pass the normal publication checks.
- Keeps incomplete imports as drafts.
- Counts unique phones with specs.
- Removes specs documents whose phone no longer exists.
- Keeps the newest specs document if legacy duplicates exist.
- Revalidates public phone, brand, and homepage caches.

Phone matching remains strict and variant-aware: exact brand + normalized model + RAM/storage variant.
