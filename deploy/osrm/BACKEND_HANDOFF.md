# K-Rides OSRM integration for the backend

Public base URL: `https://app.freebus.cloud/routing`
Same-VPS private base URL: `http://127.0.0.1:5001`

Use the private URL when the backend runs on the same VPS. It avoids public DNS,
TLS and nginx rate limits. `127.0.0.1` does not work from another server or a
separate container network; those clients should use the HTTPS URL.

## Route request

Method: GET. Path: `/route/v1/driving/{longitude},{latitude};{longitude},{latitude}`.
Coordinates are longitude first, latitude second (unlike many UI location objects).

Example: Jabi to Wuse, Abuja:

```sh
curl 'https://app.freebus.cloud/routing/route/v1/driving/7.4246,9.0721;7.4728,9.0647?overview=full&geometries=geojson&steps=false'
```

Read `code == "Ok"`, then `routes[0]`:

- `distance`: metres, not kilometres.
- `duration`: estimated seconds, without live traffic.
- `geometry.coordinates`: road line as `[longitude, latitude]` pairs.

Use `overview=false` if geometry is not needed. Do not substitute a straight line
when routing fails, or treat an unavailable route as zero distance/free fare.
The backend remains responsible for its own fare calculation and booking rules.
No authentication key is configured on this route endpoint. HTTPS currently
allows driving route GET/HEAD only, at 5 requests/second per source IP with a
burst of 20. Other OSRM services (table, match, trip) are not exposed.
Maximum route size is 25 coordinates; snapping is limited to 1,000 metres.
Avoid re-requesting a route on every WebSocket heartbeat or every GPS fix.
Cache repeated routes and use a bounded timeout; handle HTTP 429 and 5xx.

## Coverage and failures

The requested operating coverage is FCT (OpenStreetMap administrative region
`NG-FC`), including Abuja and its area councils. Complete boundary-crossing roads
and turn restrictions are retained for graph integrity; this is not a legal
geofence or a guarantee that every metre of every route stays inside FCT.
Places outside the dataset return HTTP 400 / `NoSegment` or `NoRoute`.
If bookings must enforce FCT residency for endpoints, validate the boundary in the
backend using the supplied dataset polygon rather than relying on road snapping.

## Backup routing

No production backup provider has been supplied, so production failover is not
active. The public OSRM demo's non-commercial usage rules exclude paid-ride
production traffic: https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server.

The frontend source has a configurable OSRM-compatible backup setting:
`ROUTING_FALLBACK_API_BASE_URL`. The new client is prepared locally for the next
web release; it is not part of the currently deployed production build. It tries
backup on network/timeout errors, 429/5xx or invalid responses, with a 3.5-second
per-service timeout and a 30-second per-process outage cooldown. It does not
fail over on a real coverage/NoRoute response. Production rejects the known
public demo hosts. Use a separately hosted service approved for commercial use.

Your backend must implement its own failover if it calls the raw OSRM URLs;
the raw HTTPS endpoint is not a multi-provider gateway. Keep primary and backup
coverage/profile consistent. A fallback inside the web server cannot help if the
whole shared VPS is unreachable, and no online fallback works without the
passenger/driver having a network connection.
