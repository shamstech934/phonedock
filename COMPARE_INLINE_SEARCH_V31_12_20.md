# SpecsDekh v31.12.20 — Inline Compare Search Final

- Removed the modal phone picker from the compare flow.
- Compare page opens with two independent inline phone search boxes.
- Each selected phone keeps its own slot; the next slot appears automatically up to six phones.
- Reduced autocomplete debounce to 140ms while preserving abort cancellation and browser cache.
- Added forgiving fallback search for over-specific terms such as `samsung s26 ultra`.
- Specifications remain the first comparison content after phone selection.
- Moved the differences-only control into the specifications header.
- Winner cards, verdict and compact scores remain below specifications.
- Preserved bounded results, 5-second MongoDB timeout and lightweight autocomplete payloads.
