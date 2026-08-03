# Rankings Production Fix

- Excludes discontinued, upcoming, future-dated and stale legacy devices from current rankings.
- Overall ranking requires at least three available score signals.
- Category rankings require the relevant category score and a data-confidence floor.
- Budget rankings require a verified price, value score, recent release and PKR 150,000 ceiling.
- Tie-breaking now prefers confidence, newer release year, then lower price.
- Fetches a broader candidate pool before applying eligibility rules.
- Top five cards render in five balanced desktop columns with equal-height wrappers.
- Adds visible computed ranking score and confidence tooltip.
- Adds ItemList structured data and dynamic current-year metadata.
