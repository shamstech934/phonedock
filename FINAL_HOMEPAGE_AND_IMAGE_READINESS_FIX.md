# PhoneDock v31.12.6 — Homepage Flow and Image Readiness Fix

## Fixed

- Removed the large blank area before **Trending Phones** by continuing the opening catalogue flow in the main column while the discovery sidebar remains sticky.
- Prevented duplicate Trending rendering in the later full-width section loop.
- Corrected Release Readiness image detection so a published phone passes when it has either a normalized `PhoneImage` record or the populated `Phone.thumbnail` used by the public website.
- Updated the readiness message to report only phones with no usable image source.

## Expected production result

- Trending Phones starts directly after the opening catalogue content instead of waiting for the sidebar height.
- The image readiness check no longer reports all 480 phones as missing when their thumbnails are already rendering publicly.
