# Android app as a WebView wrapper: feasibility

Research note, 2026-10-20. No app code was changed.

## Short answer

Wrapping k-express in an Android WebView is easy for everything **except** the
one thing that matters most: GPS after the app is minimised. A WebView is
Chrome's engine with the same limits as a browser tab, so `navigator.geolocation`
stops delivering fixes (and JS timers and the WebSocket get throttled or
killed) once the app goes to the background or the screen locks.

To keep drivers on the map in the background, the Android side needs a small
native **foreground location service** that posts fixes to the backend itself.
The web app only has to hand off to it through a JS bridge.

**Recommendation:** a thin Kotlin app (one `Activity` with a WebView loading the
hosted site) plus a native foreground location service, sharing the WebView's
cookie jar. Roughly **2 to 3 developer-weeks** to a Play-ready build, plus
**2 to 3 days** of frontend work, plus Play review time.

## How location works today

- `src/features/paid-rides/location/location-store.ts` wraps
  `navigator.geolocation.watchPosition` / `getCurrentPosition` (high accuracy).
- `useDriverLocationReporter` (`src/features/paid-rides/location/use-location.ts`)
  runs while the driver is `ONLINE`, `ON_TRIP` or `GOING_OFFLINE`
  (`state/use-ride-sessions.ts:126`). It sends on meaningful movement
  (≥15 m, ≥4 s apart) and a heartbeat every 10 s while parked, because the
  backend drops a driver from its Redis presence index after **15 s** without a
  fix (`config.ts`, `location.transmit`).
- Transport: WebSocket frame `{ type: "location", location }` on
  `wss://…/api/v1/rides/ws`; REST `POST /api/v1/driver/location` is the fallback
  when the socket is down.
- The code already expects background suspension: on `visibilitychange` /
  `pageshow` it grabs a fresh fix (`use-location.ts:53`), and
  `use-lifecycle-recovery.ts` re-syncs after the page was frozen. It also holds a
  screen wake lock while online. None of this keeps fixes flowing while hidden.
- **Riders never send their location to the server.** `passenger-ride-screen.tsx:81`
  only watches GPS to draw the map and choose a pickup. There is no rider
  location endpoint.

### Auth

- `POST /auth/login` sets HTTP-only `access_token` and `refresh_token` cookies on
  the **API origin** (`api.freebus.cloud`), which is a different site from the web
  app. Requests use `credentials: "include"`; a 401 triggers one
  `POST /auth/refresh` (`src/services/session-client.ts`).
- The cookies are `SameSite=None; Secure`, i.e. third-party cookies from the
  app's point of view.
- The backend spec also accepts `Authorization: Bearer <JWT>`
  (`docs/paid-rides/API_AND_WEBSOCKET_SPEC.md:45`).

## Hosted URL or static export?

**Hosted URL.** A static export isn't practical without refactoring:

- `src/app/api/*` has server route handlers (geocode, rides/geo search,
  reverse and route, route-distance, Abuja locations, push subscribe/send).
  `output: "export"` drops these.
- Dynamic routes (`/rides/[rideId]`, `/admin/drivers/[id]`, …) would need
  `generateStaticParams` or a rewrite to query-string routing.

Loading the deployed site in the WebView also means web deploys update the
Android app instantly, with no Play release. The trade-off is that the app
needs a network connection to open.

## What a plain WebView can and can't do

| Works with some wiring | Doesn't work |
| --- | --- |
| Foreground geolocation (needs `onGeolocationPermissionsShowPrompt` plus the runtime permission) | Geolocation, timers or the WebSocket while backgrounded or locked |
| Cookie login (needs `setAcceptThirdPartyCookies(webView, true)`, since the API is cross-site) | Web Push (`web-push`, `sw.js` notifications). Android WebView has no Push API |
| Document uploads (`onShowFileChooser`) | Picture-in-Picture floating tracker (`pip/`) |
| QR/camera scanning via `@zxing` (`onPermissionRequest` plus the CAMERA permission) | Screen Wake Lock is unreliable. Use `FLAG_KEEP_SCREEN_ON` natively instead |
| `tel:112` emergency call and external links (`shouldOverrideUrlLoading` → Intent) | |
| PDF/receipt downloads (`DownloadListener`; blob URLs need a bridge) | |
| Back button → `webView.goBack()` | |

Push is the second-biggest gap after background GPS. Ride offers and status
alerts would need FCM, which means a backend change to send to FCM tokens
alongside (or instead of) VAPID subscriptions.

## What the native side needs (drivers)

1. **Foreground service** with `android:foregroundServiceType="location"`, a
   persistent notification ("You're online. Sharing location with K-Rides."),
   and a "Go offline" action.
2. **Permissions:** `ACCESS_FINE_LOCATION`, `FOREGROUND_SERVICE`,
   `FOREGROUND_SERVICE_LOCATION` (Android 14+), and `POST_NOTIFICATIONS`
   (Android 13+, for the notification).
3. **`ACCESS_BACKGROUND_LOCATION` is probably not needed.** A location-type
   foreground service that starts while the app is visible (the driver taps
   "Go online") keeps receiving location after the app is minimised with only
   the "while using the app" permission. Skipping it avoids the stricter Play
   background-location review and the "Allow all the time" settings detour.
   It would only be needed to start tracking from the background, for example
   automatically after a reboot.
4. **Fused Location Provider** (`play-services-location`), using the same
   budget as the web: about 4 s / 15 m when moving, 10 s heartbeat when parked,
   never re-dating an old fix.
5. **Posting natively.** Use OkHttp with a `CookieJar` backed by Android's
   `CookieManager`, so native requests carry the same `access_token` and
   `refresh_token` cookies as the WebView. On a 401, call `POST /auth/refresh`
   and the rotated cookies land back in the shared jar, so the web app and the
   service never fall out of sync. No token is ever exposed to JavaScript, which
   keeps the current HTTP-only design. (`CookieManager.getCookie()` can read
   HTTP-only cookies natively, so a Bearer header is also possible, but the
   shared jar is simpler.)
6. **Transport.** REST `POST /driver/location` is simplest. **Check with the
   backend before relying on it:** the spec says the REST path writes to
   PostgreSQL and Redis on every call, and doesn't say whether it also
   broadcasts `ride.driver.location_updated` to the rider during a trip. If it
   doesn't, or the database load is a concern, the service should hold its own
   OkHttp WebSocket and send `{type:"location"}` frames instead.
7. **OEM battery killers.** Tecno, Infinix, itel, Xiaomi and Samsung (common
   driver phones in Nigeria) kill background services aggressively. Plan for
   an in-app "disable battery optimisation / allow autostart" guide and test on
   real devices. This is usually where most of the testing time goes.

### Play Store

- With a location foreground service and target SDK 34+, the Play Console
  **foreground service declaration** is required (what it does, why, and a
  short video). This is lighter than the background-location review.
- If `ACCESS_BACKGROUND_LOCATION` is added later, expect the full
  background-location declaration, a prominent in-app disclosure before the
  permission prompt, a video, and a longer review. Driver tracking for a
  ride-hailing app is an accepted use case, but expect at least one rejection
  round.
- A privacy policy URL and a Data safety form that declares precise location
  collection are required either way.

## Frontend changes (small)

1. **Bridge detection.** The native shell injects `window.KxNative` (via
   `addJavascriptInterface`, or better, `WebViewCompat.addWebMessageListener`
   restricted to the app's origin) and appends a marker to the User-Agent.
2. **Hand-off in `useDriverLocationReporter`.** When `listening` becomes true
   and the bridge exists, call `KxNative.startTracking({ apiBaseUrl, policy })`
   and skip `transmit()`. When it becomes false, call `stopTracking()`. Keep
   the browser watch for drawing the map.
3. **Stop on sign-out or account switch.** Hook `accountSession.subscribe`
   (already used in `location-store.ts`) to call `stopTracking()`.
4. **Optional:** native pushes its fixes into the page
   (`evaluateJavascript`/`postMessage`), so the map uses the same fix the
   server got.
5. **Feature-gate** PiP, web-push prompts (`push-notification-banner.tsx`) and the
   wake lock when running inside the shell.

None of this changes behaviour in normal browsers.

## Riders

- Riders don't send location today, so nothing breaks for them in the
  background. The rider map just catches up on resume, as it does now.
- If background rider location is wanted (for example, safety sharing during a
  trip), that's a new feature: it needs a backend endpoint and a product
  decision. Limit it to an active trip, using the same foreground-service
  pattern started from the trip screen, so it doesn't need background-location
  review.
- What riders feel more is the missing **push** ("driver arrived" while the app
  is minimised). That needs the FCM work above.

## Routes compared

| Route | Background GPS | Fit for k-express | Effort |
| --- | --- | --- | --- |
| **Kotlin WebView shell + native location service** (recommended) | Yes, natively posted, independent of the page | Best fit: hosted URL, one native feature, full control over cookies and the service | ~2–3 dev-weeks + 2–3 days frontend |
| **Capacitor** (`server.url` → hosted site) + background-geolocation plugin | Yes. `@capacitor-community/background-geolocation` is free but delivers fixes to JS, so posting depends on the WebView staying alive. Transistorsoft's plugin posts natively but needs a paid licence for Android release | Good if you want more plugins later (FCM push, camera, share). Capacitor discourages `server.url` for production and is built around bundled static assets, which this app can't produce | ~2–3 dev-weeks; less Kotlin, more plugin debugging |
| **TWA** (Trusted Web Activity / Bubblewrap) | No. It's Chrome with the same background limits. A separate native service could exist, but handing it auth and on/off state from the page is awkward | Easiest to ship (about 2–3 days) and keeps web push via Chrome, but it fails the key requirement | Not recommended for drivers |

Why Kotlin over Capacitor here: the app must be a hosted URL (server routes),
auth is cookie-based on a third-party API origin, and the only hard native need
is a location service. A small Kotlin shell keeps the moving parts few and lets
the service share the WebView's cookie jar directly.

## Open questions for the backend

1. Does `POST /driver/location` broadcast `ride.driver.location_updated` to the
   rider on an active trip, and is it fine at one call per driver every 4–10 s?
2. Is the 15 s presence TTL firm? A slightly longer TTL (for example, 30 s)
   gives Android's batching and Doze some headroom.
3. Will the backend send FCM pushes (store FCM tokens per device)?
