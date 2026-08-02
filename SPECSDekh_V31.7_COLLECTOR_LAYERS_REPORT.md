# SpecsDekh v31.7 — Modular Collector Layers

## Implemented

1. **Universal discovery layer**
   - Reads Product/ItemList JSON-LD.
   - Discovers same-domain phone product links from ordinary HTML.
   - Deduplicates product URLs and bounds each run.

2. **Parser plugin layer**
   - Parser registry chooses a domain-specific plugin when available.
   - Samsung plugin included.
   - Generic parser remains the automatic fallback for every future brand.

3. **Normalization layer**
   - All parsers return the existing `NormalizedPhone` format.
   - Brand/model identity, slug, image list and source provenance are normalized.

4. **Future brand workflow**
   - Add a Collector Source and set its supported brand.
   - The generic parser runs automatically; no code change is required for ordinary JSON-LD/HTML sites.
   - A new plugin is only needed when a website uses a unique or JavaScript-only structure.

5. **Safety and stability**
   - Product detail crawling is limited to 1–50 pages per run (default 20).
   - Existing SSRF, redirect and response-size protections remain active.
   - No AI, guessed specifications, invented URLs or automatic public publishing.

## Important limitation

Server-rendered HTML and embedded structured data are supported. A site that exposes products only after browser JavaScript execution still requires an approved feed/API or a dedicated adapter. The collector reports this clearly instead of inventing records.

## Validation

- Focused TypeScript compilation of the collector layer: passed.
- Collector architecture audit: passed.
