# Driver connection recovery and Google Maps

## Driver behaviour

The saved availability flag is no longer treated as proof of a working live connection. Drivers waiting for requests see a centered, non-dismissible **You are offline** notice if the WebSocket disconnects. It explains that requests and location updates may be interrupted, offers **Retry connection** and **Go offline**, and clears automatically after recovery. An active trip instead keeps an alert above the screen, preserving access to safety and navigation.

Recovery runs after the socket opens **and after availability changes**. This closes the race where a driver went online before the WebSocket upgrade registered their mailbox. Recovery reconciles server availability and the current ride, re-registers eligible online drivers, obtains a fresh GPS fix, and waits for the HTTP location write to succeed before showing readiness. A quiet reconciliation repeats every 20 seconds even while the socket is open to repair independently expired registry/presence entries. Failed checks retry after five seconds. Existing socket heartbeat/backoff and foreground recovery remain in place.

Manual offline decisions, active assignments, and account changes retain their existing guards. Recovery does not turn an actually offline driver online. Stale GPS or denied location access keeps the notice visible. Vibration is used when supported; an existing notification permission allows a background system notification. No unsolicited notification permission prompt is added. The green availability state and floating tracker also wait for presence recovery.

A web page cannot keep JavaScript or GPS running when iOS suspends it. The change makes interruption visible while the page runs and recovers on return; it does not guarantee background tracking when the browser is suspended or closed. No backend changes were made.

## Google Maps integration

Paid Rides now supports Google Maps rendering, Places API (New) autocomplete/details, reverse geocoding, and Routes API road previews. Search is biased toward FCT or the current location and limited to Nigeria. Suggestions have no coordinates until selected and resolved through Place Details. Autocomplete session tokens are reused while typing and reset after selection. Cancelled or obsolete selections cannot overwrite current inputs. Google failures never create placeholder booking coordinates or masquerade as road routes.

Google results use the Google map renderer. The actual map occupies the area outside the ride panels so its logo and copyright remain visible. Compact suggestion lists include Google Maps text attribution. Google recent-place details remain in memory and are excluded from persisted device preferences.

### Current local setup — verified 28 October 2026

The latest supplied key is saved only in ignored `.env.local`; it is not included in this document, source, or test fixtures. `.env.local` now selects `NEXT_PUBLIC_RIDES_MAP_PROVIDER=google`.

Live checks with the latest key passed for:

- Maps JavaScript API: the actual app map wrapper rendered Google Maps in the browser.
- Places API (New): autocomplete returned Jabi Lake Mall suggestions.
- Place Details: selecting Jabi Lake Mall resolved actual coordinates and displayed the pickup marker on the Google map.
- Geocoding: both a direct API test and the browser address lookup succeeded.

After Routes API was enabled, a live check on 28 October returned HTTP 200 with a 3,441-metre road route, a 540-second estimate, and encoded road geometry. All four services used by the current integration have now passed live API or browser checks: Maps JavaScript, Places (New), Geocoding, and Routes. There is no remaining API-activation blocker for these features. Backend matching and fare calculation remain with the existing ride service.

Deployment settings:

1. Routes API is now enabled and returns live road geometry; no additional Google APIs are required by the current implementation.
2. Keep **Maps JavaScript API**, **Places API (New)**, **Geocoding API**, and **Routes API** enabled for the project and allowed by the key's API restrictions.
3. Configure website restrictions for actual app origins, including localhost for local testing.
4. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in the hosting build environment and `NEXT_PUBLIC_RIDES_MAP_PROVIDER=google`, then rebuild/redeploy. The local build environment has been updated; hosted deployment settings were not changed.

Without a provider override, a configured key selects Google Maps; `osm` explicitly retains the existing provider. Real ride matching/fare calculation stays with the backend. This migration covers the Paid Rides screens; separate Free Buses/admin map components retain their current renderer.

Official references:

- [Maps JavaScript loader](https://developers.google.com/maps/documentation/javascript/load-maps-js-api)
- [Autocomplete data and sessions](https://developers.google.com/maps/documentation/javascript/place-autocomplete-data)
- [Routes API in Maps JavaScript](https://developers.google.com/maps/documentation/javascript/routes/get-a-route)
- [Places attribution and storage requirements](https://developers.google.com/maps/documentation/places/web-service/policies)

## Verification

- Full existing suite plus the initial connection/Google tests: 285 passed.
- Expanded focused suite: 23 passed, including confirmed HTTP presence, online/socket race, disconnect/reconnect, stale GPS, failed writes, late account results, background reconciliation, modal/banner behaviour, and deferred Google selection.
- TypeScript and scoped lint passed. The Webpack production build completed successfully (83 pages).
- A 390 × 844 browser preview verified readable offline copy and automatic dismissal after simulated recovery. This was desktop responsive testing, not physical iPhone Safari testing or a live authenticated driver session.

Latest Google verification (28 October): a temporary local browser harness exercised the actual app map wrapper and selected provider with real Google responses. It was removed after verification. No ride was booked and no live account data was changed. Routes API was subsequently enabled and verified with a live road-geometry response; no activation blocker remains.
