# Driver connection recovery and Google Maps

## Driver behaviour

The saved availability flag is no longer treated as proof of a working live connection. Drivers waiting for requests see a centered, non-dismissible **You are offline** notice if the WebSocket disconnects. It explains that requests and location updates may be interrupted, offers **Retry connection** and **Go offline**, and clears automatically after recovery. An active trip instead keeps an alert above the screen, preserving access to safety and navigation.

Recovery runs after the socket opens **and after availability changes**. This closes the race where a driver went online before the WebSocket upgrade registered their mailbox. Recovery reconciles server availability and the current ride, re-registers eligible online drivers, obtains a fresh GPS fix, and waits for the HTTP location write to succeed before showing readiness. A quiet reconciliation repeats every 20 seconds even while the socket is open to repair independently expired registry/presence entries. Failed checks retry after five seconds. Existing socket heartbeat/backoff and foreground recovery remain in place.

Manual offline decisions, active assignments, and account changes retain their existing guards. Recovery does not turn an actually offline driver online. Stale GPS or denied location access keeps the notice visible. Vibration is used when supported; an existing notification permission allows a background system notification. No unsolicited notification permission prompt is added. The green availability state and floating tracker also wait for presence recovery.

A web page cannot keep JavaScript or GPS running when iOS suspends it. The change makes interruption visible while the page runs and recovers on return; it does not guarantee background tracking when the browser is suspended or closed. No backend changes were made.

## Google Maps integration

Paid Rides now supports Google Maps rendering, Places API (New) autocomplete/details, reverse geocoding, and Routes API road previews. Search is biased toward FCT or the current location and limited to Nigeria. Suggestions have no coordinates until selected and resolved through Place Details. Autocomplete session tokens are reused while typing and reset after selection. Cancelled or obsolete selections cannot overwrite current inputs. Google failures never create placeholder booking coordinates or masquerade as road routes.

Google results use the Google map renderer. The actual map occupies the area outside the ride panels so its logo and copyright remain visible. Compact suggestion lists include Google Maps text attribution. Google recent-place details remain in memory and are excluded from persisted device preferences.

### Current local setup

The supplied key is saved only in ignored `.env.local`. It is absent from committed source, this document, and test fixtures. The original key returned a billing-disabled error. The replacement key supplied later was saved in `.env.local`; live tests now return `REQUEST_DENIED` for Geocoding and HTTP 403 `PERMISSION_DENIED` for Places Autocomplete and Routes, stating that requests to those APIs are blocked. Enable these services and include them in this key's API restrictions. `.env.local` continues to set `NEXT_PUBLIC_RIDES_MAP_PROVIDER=osm`, retaining the working map until Google accepts all required services. The Google code is installed and ready to enable.

To activate Google Maps:

1. Enable billing for the key's Google Cloud project.
2. Enable **Maps JavaScript API**, **Places API (New)**, **Geocoding API**, and **Routes API**.
3. Configure the browser key's website restrictions for the actual app origins, including localhost for local testing, and allow the four APIs above.
4. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in the hosting build environment and `NEXT_PUBLIC_RIDES_MAP_PROVIDER=google`, then rebuild. Change the provider flag in `.env.local` for local testing too.
5. Verify a map, an FCT search result, its selected coordinates, and a road route in the actual browser. Geocoding billing denial prevented live end-to-end Google verification in this run.

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
