# SpecsDekh v31.12.26 — Complete Phone Edit Prefill Fix

The admin edit endpoint now resolves the same effective data that can appear publicly:

- Public PKR price fallback from PhonePrice, verified retailer listings, and approved collector data.
- Thumbnail fallback from active PhoneImage records and approved collector media.
- Gallery fallback from thumbnail/collector images when dedicated image rows are absent.
- Retail price rows fallback from verified tracker listings.
- SEO defaults are generated only when stored SEO values are empty.
- Numeric filter fields are derived from existing text specs when dedicated numeric values are absent.

No database value is changed until the admin explicitly presses Save Phone.
