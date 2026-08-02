# SpecsDekh v31.3 — Collector Source Auto-Detect

## Completed
- Collector source form now detects JSON, CSV, RSS/XML, API, and normal website URLs.
- A Detect button and detection explanation are shown before saving.
- Quick presets added for Samsung Pakistan, GSMArena RSS, PriceOye, and WhatMobile.
- JSON-only fields are hidden for normal website sources.
- Backend re-detects source type so an incorrectly selected UI type is not stored.
- Manual Structured URL provider now supports:
  - JSON responses
  - Product/ItemList JSON-LD on HTML pages
  - deterministic structured product-link fallback
- No AI, web search, or invented product data is used.

## Important behavior
A manufacturer/category HTML page may expose product names and links, but complete specifications depend on structured data present on that page. For reliable bulk collection, prefer approved JSON/CSV/XML/RSS/API feeds.
