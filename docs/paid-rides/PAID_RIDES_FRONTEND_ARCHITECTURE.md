# Paid Rides — Frontend Architecture

Paid Rides adds on-demand, paid ride-hailing to K-Rides: a rider books a verified driver and follows the trip live; a driver goes online, accepts requests and completes trips. This document describes how the frontend is built. The backend contract it expects is in [PAID_RIDES_BACKEND_REQUIREMENTS.md](./PAID_RIDES_BACKEND_REQUIREMENTS.md); the audit that shaped it is in [PAID_RIDES_CODEBASE_INTEGRATION_ASSESSMENT.md](./PAID_RIDES_CODEBASE_INTEGRATION_ASSESSMENT.md).

## 1. Module overview

| | |
| --- | --- |
| Routes | `/rides/*` (rider) and `/rides/driver/*` (driver), outside the existing passenger/driver shells |
| Flag | `NEXT_PUBLIC_PAID_RIDES=off \| mock \| api` (default: `api` with live authentication; explicit Free Buses demo mode defaults to `mock`) |
| Data | `api` → HTTP + WebSocket backend; `mock` → in-browser simulation, isolated under `services/mock/` |
| Maps | Leaflet + OpenStreetMap tiles; Nominatim search and OSRM routing through `/api/rides/geo/*` |
| State | Zustand stores guarded by pure reducers; TanStack Query for request/response data |
| Tests | `npm run test:paid-rides` (Node test runner, type stripping) |

Running it:

```bash
npm run dev                      # http://localhost:3000/rides (live API by default)
NEXT_PUBLIC_PAID_RIDES=mock npm run dev # Isolated simulation
# Simulation controls: "Simulation" pill, top-right, in mock mode only
NEXT_PUBLIC_PAID_RIDES=api NEXT_PUBLIC_PAID_RIDES_API_BASE_URL=… NEXT_PUBLIC_PAID_RIDES_REALTIME_URL=… npm run dev
```

The REST and socket overrides are optional when using the shared Free Buses backend. Live drivers sign in directly to `/rides/driver`; their profile comes from the authenticated user and linked-car endpoints. See [Driver account integration](./DRIVER_ACCOUNT_INTEGRATION.md) for the current mapping, approval behavior and deployment settings.

## 2. Frontend architecture

```
            ┌───────────────────────── screens (React) ─────────────────────────┐
            │  PassengerRideScreen · DriverRideScreen · Chat · History · Safety │
            └──────────────┬──────────────────────────────────────┬─────────────┘
                 derive phase                               call actions
            ┌──────────────▼───────────────┐      ┌───────────────▼──────────────┐
            │ domain/phases.ts (pure)      │      │ state/*-store.ts (Zustand)   │
            │ derivePassengerPhase, …      │◄─────┤ session = reducer(state, msg)│
            └──────────────────────────────┘      └───────┬──────────────┬───────┘
                                                          │              │
                                   snapshots/mutations ───┘              └─── events
                                 ┌──────────────────────┐        ┌───────────────────────┐
                                 │ services/RideService │        │ realtime/RideRealtime │
                                 │  api  │  mock        │        │  WebSocket │ mock     │
                                 └──────────────────────┘        └───────────────────────┘
```

Rules that keep it honest:

1. **Server-authoritative.** The client never decides a ride's status. Every mutation waits for the server; every reconnect, resume and sequence gap re-reads `GET /rides/current`.
2. **One reducer.** Bootstrap, request/response and realtime events all flow through `rideSessionReducer` / `driverSessionReducer`, so ordering rules cannot be bypassed.
3. **Phases are derived, not stored.** Screens switch on one `PassengerPhase` / `DriverPhase` value; there are no `isSearching && hasDriver` booleans.
4. **Overlays are orthogonal.** Connection, location and SOS state sit beside the ride, so "Reconnecting…" never replaces the trip underneath.
5. **No component fetches.** Screens call store actions or TanStack queries backed by `getRideService()` / `getMapProvider()`.
6. **Mocks are isolated.** Only `services/ride-mock-service.ts`, `services/mock/*`, `realtime/mock-realtime-client.ts` and the dev panel know the simulation exists.

## 3. Folder structure

```
src/app/rides/                       thin route files + layout (flag gate, manifest, shell)
src/app/api/rides/geo/{search,reverse,route}   Nominatim / OSRM proxies
src/features/paid-rides/
  config.ts                          mode, flag, tunables (timeouts, radius, throttles)
  analytics.ts                       hook point (CustomEvent), no PII
  capabilities.ts                    feature detection (PiP, wake lock, share, …)
  domain/                            pure TS, Node-testable
    types.ts                         Ride, RideOffer, RideEvent, Money, Place, …
    ride-status.ts                   status machine, rank, guards
    ride-sync.ts                     snapshot/event ordering, dedupe, gaps
    ride-session.ts                  shared ride reducer (+ chat)
    driver-session.ts                availability + offers + ride
    phases.ts                        UI phase derivation, booking draft
    location-policy.ts               transmit throttling, fix quality, backoff
    format.ts                        money, ETA/distance splitting
    errors.ts                        error codes + plain-language copy
  services/                          RideService interface, api + mock implementations
    mock/                            simulated backend (timeline, pricing, fixtures)
  realtime/                          RideRealtimeClient interface, WebSocket + mock
  maps/                              MapProvider, OSM provider, Leaflet map, markers
  location/                          geolocation store, watch + reporter hooks
  state/                             passenger/driver/preferences stores, session hooks
  shell/                             module shell (bubble nav, role guard), dev panel
  components/                        sheet, bubble nav, map wrapper, characters, UI atoms
  passenger/  driver/  chat/  safety/  pip/  notifications/  history/  pages/
  styles/paid-rides.css              design-language aliases
tests/paid-rides.test.mjs
```

## 4. Passenger flow

`IDLE → SELECTING_DESTINATION/PICKUP → (CONFIRMING_PICKUP) → ROUTE_PREVIEW → REQUESTING_RIDE → SEARCHING_DRIVERS → DRIVER_MATCHED → DRIVER_EN_ROUTE → DRIVER_ARRIVING → DRIVER_ARRIVED → TRIP_ACTIVE (↔ TRIP_PAUSED) → TRIP_COMPLETED (or PAYMENT_FAILED) → rating → IDLE`, with `NO_DRIVERS_AVAILABLE`, `CANCELLED_BY_PASSENGER/DRIVER/SYSTEM` and `RESTORING` branches.

Everything happens on one screen (`/rides`) over one persistent map; the phase picks the sheet:

| Phase | Sheet | Map |
| --- | --- | --- |
| IDLE | "Where to?", pickup row, recents, location help | user location |
| SELECTING_* | full-screen search (debounced, cancellable, keyboard combobox) | — |
| CONFIRMING_PICKUP | address under the pin, Confirm | centre pin, reverse geocode on settle |
| ROUTE_PREVIEW | ride options, fare details (folded), payment, Request | route fitted above the sheet |
| SEARCHING | beacon character, status lines, Cancel (confirm) | pulses at pickup |
| NO_DRIVERS | Try again / Change ride type | pickup |
| DRIVER_* | ETA hero, identity (photo, car, colour, plate), Call/Message/Safety/Share, PIN if configured, cancel | interpolated car, dashed approach route, follow camera |
| TRIP_ACTIVE | destination, ETA + arrival time, progress, Safety/Share/Message; SOS button on map | car + route, follow camera |
| TRIP_COMPLETED | receipt, rating with expressive face and chips | whole route |

Other pages: `/rides/history` + `/rides/[rideId]` (activity and receipts), `/rides/messages` and `/rides/[rideId]/chat`, `/rides/safety`, `/rides/account`.

## 5. Driver flow

`OFFLINE → GOING_ONLINE → ONLINE_WAITING → REQUEST_INCOMING → REQUEST_ACCEPTING → (REQUEST_UNAVAILABLE: taken / expired / ineligible / failed) → EN_ROUTE_TO_PICKUP → ARRIVED_AT_PICKUP → TRIP_ACTIVE → TRIP_COMPLETED / RIDE_CANCELLED → ONLINE_WAITING`.

- Requests show earning, pickup distance/ETA, destination (when the server allows), trip distance/duration, rider rating, ride type, shared status and a countdown ring driven by the server's `expiresAt` (config fallback only when absent).
- **Accept is never optimistic.** The button shows "Confirming"; only the server response (`accepted`, `already_taken`, `request_expired`, `driver_ineligible`, `network_error`) moves the UI. A network error triggers a re-read: if the accept landed, the ride appears.
- Offers arriving while one is on screen are queued (one deep), never swapped in under the driver's thumb.
- "I've arrived" asks for confirmation when the driver is further than `arrivingThresholdMeters`; "Start ride" supports an optional PIN (`tripPinRequired`); "Complete ride" confirms, and warns when far from the destination.
- Every action uses an idempotency key derived from the ride (`arrive:<rideId>`, …), so double taps and retries are safe.

## 6. Ride state machine

Server statuses (shared with the backend): `REQUESTED, SEARCHING, NO_DRIVERS, DRIVER_ASSIGNED, DRIVER_EN_ROUTE, DRIVER_ARRIVING, DRIVER_ARRIVED, IN_PROGRESS, PAUSED, COMPLETED, CANCELLED`. Transitions are declared in `domain/ride-status.ts`; the backend document reproduces the table.

Ordering (`domain/ride-sync.ts`):

- A snapshot replaces the current ride only if `incoming.version > current.version`.
- Without versions, status rank must not decrease and terminal states never change.
- Events are de-duplicated by `id` (bounded memory) and by `seq`; a `seq` gap bumps `resyncToken`, which triggers an authoritative re-read.
- Location updates apply only if `recordedAt` is newer.
- A different ride id is only introduced by a snapshot, never by an event.

## 7. Map architecture

- `MapProvider` (data): `searchPlaces`, `reverseGeocode`, `calculateRoute`. The OSM implementation calls this app's proxies (`/api/rides/geo/*`), which add the Nominatim User-Agent, cache, and only forward the query text or coordinates. If OSRM fails, the route falls back to a smoothed estimate labelled `approximate` and drawn dashed.
- `RideMap` (render): lazily loaded Leaflet, created once and never re-created. Screens pass declarative props plus a camera intent (`point`, `fit`, `follow`) and a `cameraKey`.
  - **Sheet-aware camera:** the sheet reports how much of the map it covers; the camera pads by that amount so markers stay in the visible region.
  - **Respect exploration:** a real gesture (drag, wheel, pinch, double-click) stops auto-follow and shows **Recenter**.
  - **Interpolated vehicle:** each update tweens from the displayed position (~950 ms) with heading rotation along the shortest arc; reduced motion snaps.
- Markers are themed HTML/SVG `divIcon`s (pickup, destination, user, vehicle per class and paint, nearby, search pulses).
- Tiles: OSM by default with a token-tuned filter (and an inverted filter in dark mode); `NEXT_PUBLIC_RIDES_TILE_URL_LIGHT/DARK` swap in a styled provider. Swapping to Mapbox/Google = new provider + new `RideMap` implementing the same props.

## 8. Realtime architecture

`RideRealtimeClient`: `connect, disconnect, subscribeToRide, unsubscribeFromRide, subscribeToDriver, unsubscribeFromDriver, sendLocation, sendTyping, onEvent, onStatus, onReconnected, reconnectNow, markOffline`.

- `WebSocketRealtimeClient`: native WebSocket, cookie-authenticated, JSON frames, heartbeat every 25 s, exponential backoff with jitter (1 s → 30 s), resubscribes every channel on open, emits `onReconnected` so the session re-reads the ride.
- `MockRealtimeClient`: same contract over the simulated backend; can drop the "socket" on demand (dev panel) to exercise reconnection.
- Session hooks (`state/use-ride-sessions.ts`) own subscriptions: ride channel follows the current ride id, driver channel follows availability, and all listeners are removed on unmount.
- While the socket is not `open` during a live ride, the session polls `GET /rides/current` every 8 s.

## 9. Picture-in-Picture architecture

Capability layer: `supportsDocumentPiP()`, `supportsVideoPiP()`, `supportsCanvasCapture()`, `supportsPiP()`.

| Strategy | Where | What |
| --- | --- | --- |
| A — Document PiP | Chromium desktop 116+ | React portal into the PiP window: status, ETA, mini-map, "Back to trip" |
| B — video PiP | browsers with video PiP + `canvas.captureStream()` | canvas tracker → stream → hidden `<video>` → `requestPictureInPicture()` |
| none | iOS Safari (no captureStream), Firefox | honest explanation + notification opt-in |

**Decision:** the PiP map is a lightweight canvas schematic (`pip/trip-canvas.ts`), not a second Leaflet instance — no tile downloads, a few milliseconds per frame, redrawn twice a second. PiP is always user-initiated ("Keep your ride visible" card in the trip sheet, or the "Float trip" control after dismissal), owned by `PictureInPictureHost` so it survives approach → trip, and closed when the ride ends. It is a view only; it never maintains the connection.

## 10. Browser compatibility strategy

Target: Chrome Android, Safari iOS 16.4+, Chrome/Edge desktop, Safari desktop. Everything optional is feature-detected in `capabilities.ts` and degrades:

| Capability | Used for | When missing |
| --- | --- | --- |
| Geolocation | pickup, driver reporting | search / map pin; clear explanation per error |
| Notifications | background trip alerts | on-screen states only |
| Web Share | share trip | copy to clipboard |
| Wake Lock | screen on during trip | ignored |
| Document/video PiP | floating tracker | alerts offered instead |
| Vibration | arrival/match nudge | silent (also skipped under reduced motion) |
| `AbortSignal.any` | request timeout + cancel | caller's signal only |
| `:has()` | token scoping for portals | Safari 15.4+, Chrome 105+ |

## 11. PWA strategy

Scoped, not app-wide: `/rides` links `public/rides.webmanifest` (`scope: /rides`, `display: standalone`) through the layout's metadata, so only Paid Rides installs as an app. Notifications reuse the existing `public/sw.js` registration when present (via `registration.showNotification`). No offline caching was added: a ride needs the network, and caching stale ride state would be worse than an honest offline banner. A future step is an offline shell route in the service worker.

## 12. Offline and reconnection strategy

- `useLifecycleRecovery`: on `visibilitychange` (visible after >1.5 s hidden), `pageshow` (bfcache), `online`, and `focus` → `reconnectNow()` + re-read the ride; on `offline` → show the offline state. `navigator.onLine` is treated as a hint.
- Reconnect → resubscribe → `onReconnected` → authoritative snapshot.
- Mutations are never auto-retried blindly: the request flow re-reads the current ride after a network/timeout/conflict error, so an accepted request is found rather than duplicated.
- The connection pill shows "Reconnecting…", "You're offline · showing last known trip", then "Connection restored" for 2.4 s. The first connection on load is silent.

## 13. Security and privacy notes

- Auth follows the app: HTTP-only cookies with `credentials: "include"`; no tokens in JS, URLs or storage. The socket authenticates with the same cookie.
- No secrets in the browser: geocoding and routing go through server proxies; tile URLs are public.
- Projections are role-scoped: riders get the driver's public profile; drivers get the rider's approved name, rating and contact capability. Co-riders on shared trips are anonymised aliases.
- Contact prefers masked calling: the UI only renders a `tel:` link the server issues for that ride.
- Storage: only the current ride id, UI preferences, PiP/notification prompt choices and recent places (coordinates rounded to ~11 m, clearable in Account). Dismissed finished rides are session-scoped ids.
- Analytics events never include coordinates, addresses, names or message text.
- SOS is never sent without the hold-to-confirm gesture, and never sent in `api` mode until `NEXT_PUBLIC_PAID_RIDES_SOS_ENDPOINT=on` confirms the endpoint exists. Calling 112 always works.
- Driver screens are hidden for viewers without the `driver` role; the backend must still enforce it.

## 14. API assumptions

Documented in full in the backend requirements. Key assumptions, all isolated behind `RideService`:

- `GET /rides/current` returns the rider's live ride, and keeps returning a just-finished ride for a short while so it can be rated after a reload.
- Ride responses are the full role-scoped projection with a monotonic `version`.
- Status-changing realtime events carry the full ride; high-frequency events are thin.
- Offers carry `expiresAt`; accept is atomic and answers with one of the five outcomes.
- Money is in minor units with a currency code; fares are quotes until completion.

## 15. Design system

Paid Rides extends the existing tokens (`globals.css`) through aliases in `styles/paid-rides.css`; no new colours are introduced.

- **Colour roles:** `--ride-primary` (gold 500) / `-hover` / `-pressed`, `--ride-on-primary` (forest 950), `--ride-success|warning|danger|info|sos`, `--surface-primary|secondary|elevated|glass`, `--text-primary|secondary|tertiary`, `--border-subtle|strong`, map overlay colours (`--ride-route`, `--ride-route-approach`, markers). Dark mode redefines the overlay colours (gold routes on graphite).
- **Typography:** SF Pro / Inter. `ride-display, ride-heading-xl|lg|md, ride-body-lg|body|body-sm, ride-caption, ride-label`, and `ride-num` for tabular figures. ETA and money split value and unit (`4` large, `min` secondary).
- **Spacing:** Tailwind's 4 px scale; sheets use 20 px (mobile) / 24 px (desktop) gutters.
- **Elevation:** 0 map · 1 map controls · 2 cards · 3 sheets · 4 dialogs/panels · 5 SOS (`--ride-elev-1…5`), low-opacity layered shadows.
- **Radii:** sm 12 · md 16 · lg 20 · xl 28 · pill.
- **Motion:** instant 120 ms · fast 200 · normal 280 · slow 480; springs from `design-tokens.ts` (`snappy`, `sheet`); transforms and opacity only; everything respects `prefers-reduced-motion`.
- **Iconography:** Lucide only, 1.8–2.1 stroke.
- **Map overlays:** pickup ring, destination pin with gold square, top-down vehicle silhouettes per class tinted with the real paint colour, search pulses.
- **Bottom sheets:** content-sized, transform-only, two rests on phones (expanded / peek), drag only from the handle row, max heights per phase so the map stays visible, keyboard- and safe-area-aware; side panel on desktop.
- **Navigation:** morphing bubble nav — the active item becomes a gold lens carrying its label on a spring; hidden whenever a ride owns the screen.
- **Statuses:** connection pill, offer countdown ring, ETA chip that turns gold at "arriving", success green at "arrived".
- **Character:** "Pin", a calm map-pin face for searching, matched, confused (network/no drivers), happy (complete) and resting; plus the rating face whose expression follows the stars.

## 16. Responsive behaviour

- **Phones (320–430):** full-bleed map, floating bubble nav, bottom sheets, primary actions in the thumb zone, safe-area padding everywhere (`viewport-fit=cover`, `interactiveWidget=resizes-content`, `dvh`, `visualViewport` for the chat composer).
- **Tablet:** same as phone with wider sheets; 768–1023 keeps the bottom-sheet model.
- **Desktop (≥1024):** a 25 rem floating side panel on the left, the map takes the rest with its camera padded around the panel, the nav floats bottom-right, chat is a centred column.

## 17. Accessibility

- Semantic landmarks, headings and lists; every icon-only control has an accessible name and a visible label where it matters (contact/safety tiles).
- Ride status changes are announced through a polite live region; the connection pill is a status region.
- Search is a combobox with `aria-activedescendant` and arrow-key navigation; ride options, rating and emergency types are radio groups.
- Dialogs reuse the app's `Modal` (focus trap, Escape, focus restore). Sheets are labelled regions; the collapsed sheet content is `inert`.
- SOS hold works from the keyboard (hold Space/Enter) and announces its hint.
- Colour is never the only signal (text with every status). Targets ≥ 44 px. Reduced motion collapses all animation and snaps the vehicle.

## 18. Testing strategy

`tests/paid-rides.test.mjs` (27 tests) covers the parts where bugs would be dangerous:

- Status machine guards; snapshot ordering with and without versions; duplicate events; sequence gaps; stale locations.
- Passenger: request + double-tap guard, no drivers, match over realtime, late event can't regress the trip, cancellations, restore after reload, keep a finished ride for rating, chat reconciliation and receipts.
- Driver: offers only when online, expiry (server deadline, fallback, event), accept waits for the server, already-taken conflict, queued offers, availability following the ride, refusing offline mid-trip.
- Location throttling and fix quality; reconnect backoff; ETA/distance formatting.
- Simulation: full lifecycle with monotonic versions, determinism after "reload", scenarios, driver actions, fare lines summing to totals.

Not automated (no React test runner exists in the repo): component rendering. Those flows were exercised in the browser at 375 × 812 and 1366 × 860 in mock mode. Before rollout, add Playwright journeys for request → match → trip → rating and offer → accept → complete, and test on physical iOS/Android devices for geolocation, wake lock, PiP and notifications.
