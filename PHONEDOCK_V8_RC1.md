# PhoneDock v8.0 RC1 — Smart Assistant & Production Polish

## Implemented

- Redesigned Buying Assistant with responsive, dark-mode-safe UI.
- Added one-click Roman Urdu/English sample prompts.
- Added safe price formatting so missing prices do not display as PKR 0.
- Added parsed intent chips for budget, PTA and priorities.
- Added clear loading, API error, warning and no-match states.
- Added confidence labels, verdicts, compromises and missing-data disclosure.
- Added cheaper, upgrade and balanced alternatives directly to result cards.
- Improved Roman Urdu normalization and mixed-priority detection.
- Improved budget parsing for `80k`, `80 hazar`, `1 lakh`, PKR and rupee formats.

## Existing modules preserved

The existing Compare, Price History, Alerts, Wishlist, Accounts, Analytics and admin modules were not duplicated or removed.

## Deployment

Use the same environment variables as the currently working v7.0.2.1 deployment. Deploy this release as a preview first, then promote it after testing `/buying-assistant` on desktop and mobile.
