# Homepage Blank Space Flow Fix

## Root cause
The homepage rendered only Popular Brands and Latest Phones inside the left column, while Trending, Camera, Gaming, Battery, Budget, Flagship, and Upcoming sections were rendered after the complete two-column row. Because the right filter sidebar was taller than Latest Phones, the next full-width section waited for the sidebar height and produced a large empty area.

## Fix
- Moved all core phone discovery sections into the left content flow.
- Kept Price Categories, Smart Filters, and Phones by Year in an independent sticky right sidebar.
- Added `items-start`, `self-start`, and `min-h-0` safeguards.
- Kept Videos, Reviews, and News full-width below the discovery grid.
- Preserved configured section order and visibility rules.
- Preserved responsive stacking on tablet and mobile.

## Expected result
Trending Phones now begins directly after Latest Phones on the left, even when the right sidebar is taller. No artificial blank block should appear between the sections.
