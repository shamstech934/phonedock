# Price Tracker Add Source Runtime Fix

Fixed `Cannot read properties of null (reading 'value')` when changing fields in the New Price Source form.

All add-source change handlers now copy `event.currentTarget.value` into a local variable before entering a functional React state update. This prevents React synthetic-event targets from becoming null before the updater executes.

Affected fields: source name, source type, base URL, allowed domains, and priority. Existing edit-source safety fixes remain unchanged.
