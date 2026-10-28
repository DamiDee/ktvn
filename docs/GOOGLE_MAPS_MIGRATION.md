# Google Maps migration and server deployment

Updated 28 October 2026. This guide supersedes the OpenStreetMap/OSRM setup
instructions in older map documents for the website.

## What changed

All active website maps use Google Maps: passenger and driver rides, admin live
drivers, Free Buses place pickers, and the shared route map. Places API (New)
supplies place suggestions; Geocoding API supplies address lookups; Routes API
supplies road geometry, distance, and travel time. A missing Google key shows an
unavailable state instead of switching back to OpenStreetMap.

The existing Android app displays the hosted website in its WebView. Deploying
these website changes also changes its maps. This provider change does not
require an APK rebuild or Maps SDK for Android. Native background location
continues independently of the map renderer.

The separate API at `api.freebus.cloud` remains responsible for fare quotes and
ride events. Its source is not in this repository. This change does not replace
that API's routing configuration or fare calculation automatically.

## Deploy on the existing server

Commit and push these source changes first. In the existing deployment directory
on the server (previous deployment scripts use `/root/ktvn` and PM2 app `ktvn`):

```sh
cd /root/ktvn
git pull
npm ci
npm run maps:configure
npm run build
pm2 restart ktvn --update-env
npm run maps:verify -- https://app.freebus.cloud
```

`maps:configure` prompts for the browser key with input hidden, then an optional
server key. Press Enter at the second prompt to use the same currently working
key. It preserves other settings and backs up an existing `.env.production.local`
before writing it with owner-only permissions. That file and its backup are
ignored by Git. Run the command interactively; do not put a key in a shell command.

Successful verification prints `provider: "google"`, `configured: true`, and
`status: 200`. It checks the deployed website configuration, not Google API
permissions. Open the website and check a map and a place search as the final
deployment check. A 404 means the new endpoint has not reached the running app;
a 503 means the running app has no browser key.

If verification fails on the deployment server, compare the public address with
the app's local listener:

```sh
npm run maps:verify -- https://app.freebus.cloud
npm run maps:verify -- http://127.0.0.1:4000
```

If the local check passes while the public check fails, the app has its settings;
investigate the server's public-domain DNS, TLS certificate, network access, and
reverse proxy. The verifier now distinguishes connection, timeout, TLS, missing
endpoint, missing key, and gateway errors without printing keys or error pages.
The previous generic error also covered HTML error responses and network
failures; it did not identify which condition occurred.

Normal development and production builds explicitly use Webpack. During this
migration the installed Next.js Turbopack development server returned 404 for
new API routes; the Webpack server served and passed those checks.

## Google project and key settings

Enable billing and these APIs in the same Google Cloud project:

- Maps JavaScript API
- Places API (New)
- Geocoding API
- Routes API

`GOOGLE_MAPS_BROWSER_API_KEY` is a public browser key. It is returned by the
uncached `/api/maps/config` endpoint, so the live server can supply it even if
the browser bundle was built without a key. Restrict browser usage to the real
website origins, including `https://app.freebus.cloud/*` and any development
origins you use. The Android WebView loads that website origin too.

`GOOGLE_MAPS_SERVER_API_KEY` stays on the server and is used by the website's
route, distance, and legacy address proxy endpoints. A separate key restricted
to the server IP is appropriate for these requests; a website-restricted key
may reject server calls. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` remains a build-time
browser fallback for old hosting setups. Existing process environment values
take precedence over files; update any conflicting PM2 environment settings.

## Move backend fare routing from OSRM to Google

The website now has a compatibility endpoint backed by Google Routes:

```text
Base URL: https://app.freebus.cloud/api/routing
GET /route/v1/driving/7.4243,9.0767;7.4447,9.0663?geometries=geojson&overview=full&steps=false
```

Its response preserves the route fields documented for the existing integration:

```json
{
  "code": "Ok",
  "provider": "google",
  "routes": [{
    "distance": 3441,
    "duration": 540,
    "geometry": { "type": "LineString", "coordinates": [[7.4243, 9.0767], [7.4447, 9.0663]] }
  }]
}
```

The geometry above is shortened for illustration. Distance is in metres,
duration in seconds, and geometry pairs are longitude then latitude. Routes use
driving mode without live traffic, preserving a stable road-distance basis for
the existing fare formula. The actual fare must still come from the backend.

In the deployment settings for **the backend API**, change its OSRM routing base
URL to the base above and restart that API. The setting name cannot be confirmed
without the backend source. Changing the old `ROUTING_API_BASE_URL` in this
website's settings does not change the separate backend. Before switching,
confirm the backend uses the supported fields and requests GeoJSON; then compare
a real fare quote and the returned route against the new Google metrics.

This adapter supports 2–25 coordinates, route geometry, distance, and duration.
It rejects encoded-polyline, turn instructions, and alternative-route requests;
it does not implement OSRM table, match, trip, legs, or waypoint services. If
the backend needs those, its integration needs an explicit update. Requests fail
clearly if Google cannot route; they do not become a straight-line or zero fare.

The website's `/api/rides/geo/route`, `/api/route-distance`, `/api/geocode`,
`/api/rides/geo/search`, and `/api/rides/geo/reverse` also use Google. Billable
proxy endpoints reject browser requests from other origins and impose a
per-process, per-IP request window. They are not a substitute for Google project
quotas or a shared rate limiter across multiple app processes.

Old OSRM deployment files and pure tile/route utilities remain for historical
reference; active website code no longer imports them. The existing OSRM server
has not been stopped, since the separate backend may still depend on it.

## Validation completed locally

- All 308 automated tests passed, including runtime key selection, private-key
  isolation, route parsing, compatibility response units, and request limits.
- TypeScript, lint checks for changed map/API code, and the production build passed.
- Browser checks loaded the three shared Google map surfaces, resolved Jabi Lake
  Mall, selected an admin driver, and drew the Google road route. Phone-width
  suggestions were also inspected; this was not a physical iPhone/Safari test.
- The production server picked up a runtime browser-key override. Its road and
  compatibility endpoints returned Google geometry: 3,441 metres, 540 seconds,
  and 145 points for the public Jabi-to-Utako test coordinates.
- The setup command preserved unrelated settings, masked key input, created a
  backup, and saved files with owner-only permissions in a temporary fixture.

These checks do not confirm the live deployment, a real backend fare quote, or
an installed Android app session. No live server configuration was changed.
