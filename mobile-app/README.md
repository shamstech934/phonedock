# PhoneDock Mobile

Isolated Expo/React Native application consuming PhoneDock's existing public APIs.
It does not change the website build, MongoDB models, admin panel, or production deployment.

## Phase 0 scope

- Native tab navigation
- Home, paginated phones, search, brands and phone-detail screens
- Shared typed API client with validation, timeout and safe errors
- Query caching/retry and image disk caching
- Responsive two-column cards with stable content areas
- Deep-link scheme: `phonedock://`

Authentication, wishlist, comparison, alerts and offline downloads remain later phases.
The website currently authenticates users with an HttpOnly browser cookie. Mobile auth
must receive a dedicated secure token/refresh-session contract before those features are
enabled; the app deliberately does not store passwords or imitate browser cookies.

## Run locally

1. Copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_API_URL` to the deployed PhoneDock URL or a LAN-accessible local URL.
3. Run `npm install`.
4. Run `npm run typecheck`.
5. Run `npm start` and open with Expo Go or an emulator.

Do not use `localhost` from a physical phone. Use the computer's LAN IP for a local API.

## Recommended next phases

1. Secure mobile authentication contract and encrypted token storage.
2. Wishlist, compare and recently viewed.
3. Price alerts and push notifications.
4. Offline cache, analytics and crash reporting.
5. EAS staging builds, device E2E and store release pipelines.
