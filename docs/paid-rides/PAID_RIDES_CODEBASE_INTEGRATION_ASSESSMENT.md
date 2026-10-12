# PAID RIDES — CODEBASE INTEGRATION ASSESSMENT

Audit of `k-express` (K-Rides) on 12 October 2026, branch `feature/paid-rides`
cut from `main` at `7d3ac78` with a clean working tree.

## What I found

| Area | Finding |
| --- | --- |
| Framework | Next.js **16.3.4**, App Router, React **19.2.8**, TypeScript strict, Turbopack. `params` are Promises. |
| Routing | `src/app/{(public),(auth),passenger,driver,admin}`; pages are thin and delegate to `src/features/*`. |
| Shells | Demo: `AppShell` (dark rail on desktop, bottom nav on mobile). Live (default, `NEXT_PUBLIC_FREE_BUSES_MODE=live`): `LiveFreeBusShell` wraps **all** of `/passenger/*` and `/driver/*` and replaces any page that isn't Free Buses with "We're focused on Free Buses". |
| State | Zustand 5 for synchronous UI/session state (`stores/`), TanStack Query 5 for server state. |
| Design system | `src/app/globals.css` is the single source of truth: `--kx-*` tokens for forest green, graphite, warm gold, lilac, status colours, surfaces, radii (8–32px), layered low-opacity shadows, motion durations and eases, plus a full dark palette under `.dark`. Tailwind v4 `@theme inline` maps them to utilities (`bg-surface`, `text-ink`, `shadow-sheet`…). Type recipes: `type-display`, `type-page-title`, `type-section-title`, `type-card-title`, `type-body(-lg)`, `type-meta`, `type-micro`, `type-numeric` (tabular figures). `constants/design-tokens.ts` mirrors durations, springs, eases and breakpoints for JS. |
| Typography | SF Pro where available, Inter fallback (Google Fonts import in CSS). |
| Icons | `lucide-react` only, stroke 1.7–2. |
| Dark mode | Yes — `next-themes` with `class` strategy; the dark palette is redefined, not inverted. Paid Rides must support it. |
| Components | `components/ui`: Button / IconButton / ButtonLink (cva, travelling-dots loading, never spinners), Avatar, StatusChip, Skeleton family, EmptyState / ErrorState, Modal / ConfirmDialog (focus trap), BottomSheet (drag detents), Toast provider, Rating, ConnectivityBanner. |
| Motion | `motion` 13 (Framer Motion). Presets in `lib/motion.ts`; springs are deliberately non-bouncy; reduced motion honoured globally in CSS and via `useReducedMotionSafe`. |
| Forms | React Hook Form + Zod. |
| Auth / roles | Live: cookie session against `api.freebus.cloud` (`liveAuth.session`), roles `User`, `Driver`, `RouteCoordinator`, `Admin`, `Root`. Demo: persisted Zustand session. No ride-hailing auth exists yet. |
| HTTP | Demo repositories go through `services/api-client.ts` (simulated latency/failure). Live Free Buses uses `services/freebus-api.ts` (`fetch`, `credentials: "include"`, typed `FreebusError`). |
| Env | `NEXT_PUBLIC_FREE_BUSES_MODE`, `NEXT_PUBLIC_FREEBUS_API_BASE_URL`, `ROUTING_API_BASE_URL` (OSRM), VAPID keys. |
| Realtime | **None.** No WebSocket, Socket.IO, Pusher, Supabase or Firebase. |
| Maps | **Leaflet 1.9** + OpenStreetMap tiles (`ui/map-picker.tsx`), Nominatim geocoding proxied by `GET /api/geocode`, OSRM driving distance proxied by `GET /api/route-distance`. Separately, `components/maps/MapCanvas` is a procedural SVG "map" used by the demo screens — not a real map. |
| Notifications | Web Push with VAPID: `public/sw.js`, `usePushNotifications`, `/api/push/*` (in-memory store). Push permission is requested only on an explicit opt-in. |
| PWA | No manifest; service worker only for push. |
| Breakpoints | Tailwind defaults plus `xs` (26rem). Mobile < 768, tablet 768–1023, desktop ≥ 1024. |
| Loading / errors | Route-line loader and skeletons instead of spinners; plain-language `ErrorState` with retry. |
| Tests | `node:test` with `--experimental-strip-types` (`npm run test:free-buses`), pure modules only — no React test runner is installed. |
| Lint | ESLint 9 flat config, `eslint-config-next` core-web-vitals + TypeScript (includes the React Compiler hook rules). |
| Feature flags | None beyond the Free Buses mode switch. |
| Analytics | None. |
| Existing ride demo | `/passenger/request`, `/passenger/matching`, `/passenger/trip` and the driver equivalents run on mocks with a `RideStatus` enum in `lib/state-machines.ts`. They are hidden behind the live shell and are not touched. |

## What will be reused

- All `--kx-*` tokens, type recipes, shadows, radii, surfaces, dark palette; Paid Rides adds **semantic aliases** (`--ride-*`, `--surface-*`, `--text-*`) that point at them rather than new colours.
- `motion` with the existing springs and `useReducedMotionSafe`; `lucide-react`; `cn`; `Button`/`IconButton`/`Avatar`/`Skeleton`/`ToastProvider`/`EmptyState`.
- Leaflet + OSM tiles as the map renderer, `/api/geocode` (Nominatim) for place search, `ROUTING_API_BASE_URL` (OSRM) for routing.
- `lib/geo.ts` (haversine, bearing, distance-along-path) for interpolation and simulation.
- `public/sw.js` for notification display; TanStack Query for request/response data; Zustand for the live ride mirror and UI preferences.
- The `node:test` + strip-types test style.

## What must be introduced

- A top-level `/rides` route tree with its **own immersive shell**. It cannot live under `/passenger` or `/driver`, because the live shell replaces those pages.
- A `paidRides` feature flag (`NEXT_PUBLIC_PAID_RIDES=off|mock|api`; defaults to `mock` in development and `off` in production).
- A ride service interface with **API** and **mock** implementations, a realtime client interface with **WebSocket** and **mock** implementations, a map-provider adapter, and a geolocation layer.
- Two small proxy routes: reverse geocoding and route geometry (the existing distance route discards geometry).
- A scoped web manifest (`/rides.webmanifest`, scope `/rides`) rather than an app-wide one.
- `allowImportingTsExtensions` in `tsconfig.json` so the pure ride core can import itself with `.ts` extensions and be unit-tested under Node's type stripping. It is a no-emit project, so this changes nothing at build time.

## Major browser constraints

- Background tabs throttle timers, suspend JS and can drop sockets; iOS Safari freezes pages quickly. The server must stay authoritative, and the client re-fetches `GET /rides/current` on `visibilitychange`, `pageshow`, `online` and reconnect.
- Geolocation requires HTTPS and a user gesture-adjacent prompt; iOS reduces updates in the background; `watchPosition` must be stopped when not needed.
- Document Picture-in-Picture: Chromium desktop only (116+). Video PiP: Safari and Chrome, but needs a playing `<video>`; `canvas.captureStream()` is missing on iOS Safari. PiP is never a connectivity guarantee.
- Web Push on iOS works only for installed home-screen apps (16.4+). Wake Lock: Chrome 84+, Safari 16.4+. Web Share: mobile Safari/Chrome, not Firefox desktop. Vibration: Android only.

## Proposed file structure

```
src/app/rides/                     routes (thin), layout = flag gate + RideModuleShell
  page.tsx                         passenger map: book → live ride → completion
  current/ history/ [rideId]/{chat,safety}/
  driver/{page,requests,history,messages}/
src/app/api/rides/geo/{reverse,route}/route.ts
src/features/paid-rides/
  config.ts                        flag, mode, tunables (timeouts, radius, throttles)
  domain/                          pure TS, Node-testable: types, status machine, reducers,
                                   event ordering, fare/ETA formatting, location policy
  services/                        ride-service (interface), ride-api-service, ride-mock-service,
                                   mock/ (simulation world, kept out of production code)
  realtime/                        RideRealtimeClient interface, websocket client, mock client, backoff
  maps/                            MapProvider interface, OSM/Nominatim/OSRM provider,
                                   lazy Leaflet RideMap, markers
  location/                        geolocation hook + throttled reporter
  state/                           Zustand stores (ride session mirror, UI prefs), session bootstrap
  components/                      bubble nav, ride sheet, ETA/fare, vehicle glyphs, characters…
  passenger/  driver/  chat/  safety/  pip/  notifications/
docs/paid-rides/                   this assessment, frontend architecture, backend requirements
tests/paid-rides-*.test.mjs
```

## Proposed state architecture

- **Server state** — the live ride is a mirror of the server's ride. It sits in a Zustand store guarded by a pure reducer that applies snapshots and events by `version`/`seq`, dedupes event ids and never regresses status rank. Request/response data (places, estimates, history, messages) uses TanStack Query.
- **UI phase** — derived, never stored: `derivePassengerPhase(draft, ride, overlays)` yields `SELECTING_DESTINATION`, `ROUTE_PREVIEW`, `SEARCHING_DRIVERS`, `DRIVER_EN_ROUTE`, `TRIP_ACTIVE`… Connection loss, location problems and SOS are **orthogonal overlays**, so a dropped socket never erases the trip underneath it.
- **UI state** — the booking draft (pickup, destination, chosen option), sheet size, PiP-prompt dismissal and camera mode live in small local stores; only non-sensitive keys persist (current ride id, preferences).

## Realtime architecture

`RideRealtimeClient` exposes `connect`, `disconnect`, `subscribeToRide`, `subscribeToDriver`, `sendLocation`, `sendTyping` and an event stream plus a connection-status stream. The WebSocket implementation adds exponential backoff with jitter, a heartbeat, resubscription and a reconciliation hook after every reconnect. Event envelopes carry `id`, `seq`, `rideVersion` and a server timestamp. Components never touch sockets; they read the store. The mock implementation drives the same interface from the simulation.

## Mapping architecture

`MapProvider` (data: `searchPlaces`, `reverseGeocode`, `calculateRoute`) is implemented on Nominatim + OSRM through server proxies, so no keys reach the browser and provider usage policies are respected. `RideMap` (render: route, markers, `fitRouteBounds` with sheet-aware padding, interpolated vehicle markers, recenter) is a lazily loaded Leaflet component. Swapping in Mapbox or Google means a new provider and a new `RideMap` implementing the same props. Tiles default to OSM with token-driven styling and can be overridden per theme by env. The PiP window uses a lightweight canvas renderer instead of a second Leaflet instance.
