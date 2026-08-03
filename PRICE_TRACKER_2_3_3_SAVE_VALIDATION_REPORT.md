# PhoneDock Price Tracker 2.3.3 — Source Save Validation

## Fixed

- Source edit now validates the verification URL before submitting.
- Wrong-domain errors identify both the allowed source domain and the supplied domain.
- Verification URL, base URL, name and priority errors are attached to the relevant form field.
- The API returns structured `field` and `code` values for URL validation failures.
- Verification URLs are normalized before storage.
- Changing a verification URL resets trust and requires a fresh Test & trust run.
- Source status and enabled state are kept consistent.
- Successful updates return the updated source and a success message.
- Activity logging remains enabled for source updates.

## Expected Samsung example

A Samsung source with allowed domain `samsung.com` will reject a SpecsDekh URL with:

`Verification URL must belong to samsung.com. Current URL belongs to specsdekh.com.`

Use a real Samsung Pakistan product URL, save the source, and then run Test & trust.

## Validation limitation

A full dependency install/typecheck was not available in this container because node_modules are absent. Focused static checks were run against the modified frontend and API paths.
