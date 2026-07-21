# Collector administrator guide

Open **Admin → Collector → Sources**, select an approved structured provider, enter its HTTPS endpoint and optionally a JSON data path, brand filter, schedule and secret environment-variable name. Credentials belong in deployment secrets; never paste tokens into headers. Test the connection before enabling it, inspect the sample, then run an incremental or full sync.

Review pending drafts for source attribution, missing fields, warnings, duplicates and conflicts. Invalid records cannot be approved. For matches, approve only the reviewed incoming fields; manually curated data must not be replaced without explicit review. Delete/cancel active jobs before deleting a source.

Download templates from `/templates/phones.csv`, `/templates/phones.json`, `/templates/prices.csv`, and `/templates/prices.json`. Use licensed images and public/approved feeds only.
