# Sprint 9 — Price Buying Guidance

This patch adds conservative public buying guidance to the phone price tracker.

## Behaviour

- Requires at least three confirmed price observations before making a decisive recommendation.
- Uses the phone's current position inside its confirmed low/high range.
- Compares the current price with the tracked average.
- Considers the most recent confirmed price movement.
- Returns one of: `buy_now`, `good_price`, `wait`, or `insufficient_data`.
- Displays a plain-language explanation on the phone detail page.

No database migration or new environment variable is required.
