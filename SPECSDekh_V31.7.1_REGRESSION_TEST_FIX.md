# SpecsDekh v31.7.1 — Collector Regression Test Fix

## Fixed

- Updated the outdated Data Platform v2 manufacturer-provider assertion.
- The test now validates the modular parser-registry architecture instead of the removed “approved adapter” behavior.
- It asserts that an unconfigured manufacturer source reports `No URL configured`.
- It confirms the registered `samsung` and `generic` parsers are advertised.
- Existing collector, Price Tracker, parser registry, and production code remain unchanged.

## Root cause

The collector architecture was upgraded from a disabled vendor-adapter placeholder to a modular parser registry, but one regression test still expected the legacy `approved adapter` message.
