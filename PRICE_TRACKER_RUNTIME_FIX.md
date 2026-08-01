# Price Tracker Edit Modal Runtime Fix

Fixed the edit-source modal crash:

`Cannot read properties of null (reading 'value')`

## Root cause

React change-event values were read inside functional state updater callbacks. The event target can be released before that callback executes.

## Fix

All edit-source form handlers now copy `event.currentTarget.value` or `checked` into a local constant before calling `setEditSourceForm`.

Affected fields:

- Source name
- Source type
- Base URL
- Allowed domains
- Priority
- Status
- Trusted toggle
- Notes

No database schema or source records were changed.
