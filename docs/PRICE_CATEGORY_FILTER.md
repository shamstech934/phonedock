# Price Category Filter

The `/phones` catalogue supports URL-synchronized price categories through `priceCategory`.

| Key | Label | PKR range |
| --- | --- | ---: |
| `entry-level` | Entry Level | below 25,000 |
| `budget` | Budget | 25,000–49,999 |
| `mid-range` | Mid Range | 50,000–99,999 |
| `upper-mid-range` | Upper Mid Range | 100,000–149,999 |
| `premium` | Premium | 150,000–249,999 |
| `flagship` | Flagship | 250,000 and above |
| `price-unavailable` | Price Unavailable | missing, null, zero or negative |

Definitions live in `src/lib/price-categories.ts` and are shared by the server listing query, API query mapping and client UI. Desktop uses a sticky left sidebar. Smaller screens use a labelled select control in the existing filter area.

Examples:

- `/phones?priceCategory=budget`
- `/phones?brand=samsung&priceCategory=mid-range`
- `/phones?q=galaxy&priceCategory=price-unavailable`

Changing a price category resets pagination to page 1. Legacy `price` links remain supported, but selecting a category removes the legacy parameter to prevent conflicting ranges. No category value is written to phone documents; results are calculated from the current `pricePKR`, so price updates cannot leave stored categories stale.
