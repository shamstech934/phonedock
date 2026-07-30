# PhoneDock shared web and mobile control

Phone records, brands, prices, discounts and lifecycle states remain in the existing shared MongoDB database. They must never be duplicated into a separate mobile database.

## Admin usage

Open **Admin → Mobile App Control**.

- Availability: remotely enable maintenance mode without shipping a new app.
- Releases: set semantic versions such as `0.1.0`; force update only when the installed version is below Minimum Supported Version.
- Navigation: show or hide approved mobile tabs.
- Feature flags: safely release app features gradually.
- Campaign: manage mobile-only promotional content.
- Homepage: order mobile sections independently from the website.

## Public contract

The app reads `GET /api/mobile/config`. This endpoint exposes only allowlisted public presentation settings. Admin permissions, secrets and internal settings are never returned.

Phone data continues to use `GET /api/phones`, `GET /api/phones/:slug`, `GET /api/brands` and `GET /api/phones/autocomplete`.

## Safety

- Temporary configuration failure does not brick the app; bundled defaults remain usable.
- Maintenance and forced-update screens are controlled from the server.
- Admin URLs accept internal paths or HTTPS only.
- Arbitrary JavaScript and CSS cannot be entered through this control center.
