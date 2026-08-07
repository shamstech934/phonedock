# SpecsDekh v31.12.52 — Tagline Display Fix

- Confirmed the CMS/admin tagline was already persisted by the Settings model and admin settings API.
- Public Header now consumes and displays the saved tagline directly below the website name.
- Homepage Builder live responsive preview now uses the unsaved Website name and Tagline values instead of a hard-coded SpecsDekh label.
- Empty taglines remain hidden so existing layouts do not gain blank spacing.
- Long taglines are truncated safely in the header to protect responsive navigation.
