# Phone Edit Benchmark Prefill Fix — v31.12.30

- Admin phone-detail API now loads benchmark data from the canonical PhoneBenchmark record.
- When canonical benchmark fields are empty, it safely falls back to approved CollectedPhone benchmark values and legacy aliases.
- Existing non-zero canonical values always win.
- No estimated comparison scores are silently persisted as authoritative benchmark data.
- Camera/performance/battery/display/value/overall scores still come from stored Phone fields; zero means no authoritative score has been saved yet.
