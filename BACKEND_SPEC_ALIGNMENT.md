# Paid Rides: backend spec vs frontend requirements

Compares the backend developer's `API_AND_WEBSOCKET_SPEC.md` (Rust/Axum "K-Ride" engine, 15 Oct 2026) with `PAID_RIDES_BACKEND_REQUIREMENTS.md` (what the frontend on `feature/paid-rides` expects). Section numbers: **S§** = spec, **R§** = requirements.

## Verdict

The architecture lines up well: same base paths (`/api/v1`, `/rides/ws`), same event envelope (`id`, `rideId`, `seq`, `rideVersion`, `occurredAt`, `payload`), same Money and LatLng shapes, same event names for offers, ride updates and live location, atomic first-accept-wins on offers, and the same core status names. Integration of the core loop (estimate, request, offer, accept, arrived, start, complete, live car on map) can start, with most differences absorbed in the frontend's HTTP and socket adapters.

Three things must come from the backend before that loop can work end to end:

1. **The `RideProjection` schema.** The spec returns `RideProjection` from every ride endpoint and `ride.updated`, but never defines it. The frontend's whole ride screen is driven from this object (R§2.3). Without it the adapter cannot be written. Ask for the JSON shape (passenger view and driver view), and confirm it has a `version` integer.
2. **Cookie auth on the socket, and cross-site cookies.** Browsers cannot set an `Authorization` header on a WebSocket upgrade, and the frontend keeps no token in JavaScript (R§0). The spec says the cookie is accepted (S§1.2) but the handshake example only shows the header (S§2.1). Confirm the cookie works at upgrade, which cookie name, that it is the same login session K-Rides already uses, and that CORS allows the app origin with credentials (`SameSite=None; Secure` if the API is on another domain).
3. **Roles in `GET /rides/me`.** The frontend reads `roles` to decide whether to show driver screens (R§2.1). The spec returns `{ user, activeRide }` with no role, and the role lives only inside the JWT, which the browser cannot read from an HTTP-only cookie. Add `roles` (or `role`) to `/me`. Also confirm whether a `Driver` account can book rides as a passenger, since the JWT has a single role.

## Fix on the backend (correctness, privacy, safety)

| # | Issue | Why it matters | Ask |
| --- | --- | --- | --- |
| B1 | Offer sends passenger `id`, full `lastName` and raw `phone` (S§2.5); `/me` also returns `id` and `phone`. | R§2.3 and R§6: no internal ids or raw phone numbers to the other party; drivers see an approved display name and a contact capability. | Drop `id`/`phone` from the offer; send `displayName` and `rating`. Phone only after assignment, and only if the product approves direct calling. |
| B2 | `seq` semantics unclear: both examples show `seq: 1` on different events. | The frontend de-duplicates by `seq` and treats a gap as "re-read the ride" (see the frontend architecture doc). If `seq` repeats, real events get dropped as duplicates; if it jumps, the app keeps re-reading. | Define `seq` as strictly increasing per connection (or per channel, stated which), or tell us to ignore it. |
| B3 | Redis dead-man TTL is 15 s (S§1), but the frontend sends a stationary driver's fix only every 20 s (R§5). | A parked online driver drops out of the matching index for ~5 s of every 20 s and misses offers. | Either raise TTL to 30–45 s, or we drop the frontend heartbeat to 10 s. One side must change; frontend change is a one-line constant. |
| B4 | No `GET /driver/rides/current` (R§2.5). | A driver who reloads mid-trip cannot recover the ride. | Add it, or confirm `GET /rides/current` returns the driver's active ride for a driver. |
| B5 | Subscribe authorisation not stated (S§2.3). | Anyone could subscribe to `ride:<id>` and track a stranger's car (R§6). | Confirm only the rider and assigned driver may subscribe; reject others. |
| B6 | No idempotency (R§0). | A retried "Request ride" on a flaky network could create two rides; a retried "complete" could double-settle. Accept is safe (CAS). | Honour `Idempotency-Key`, or at minimum return `409 conflict` when the rider already has a live ride. |
| B7 | Error body not specified. | The frontend shows specific messages for `already_taken`, `request_expired`, `estimate_expired`, `no_drivers`, `conflict`. | Return `{ code, message }` on errors; say what an expired offer accept returns (410?). |
| B8 | Status table contradicts the endpoints (S§7): `NO_DRIVERS` "can retry via `/retry`" but no retry endpoint exists; driver cancel "resets ride to SEARCHING" but `DRIVER_ASSIGNED → SEARCHING` isn't in the table. | Ambiguity about what the passenger sees after a driver cancels or no driver is found. | Document `/retry` (or drop it) and add the re-dispatch transitions. |
| B9 | Availability is in RAM (`ws_registry`). | After a server restart, drivers look online in the DB but their fixes are ignored until they toggle again. | Rehydrate online state on restart, or emit `driver.availability.changed` (offline) so the app shows it. |
| B10 | Location event has no ETA (S§2.5). | R§5 wants route-aware ETA/remaining distance with each fix; the passenger's ETA chip won't tick down. | Add `approach` / `progress` to `ride.driver.location_updated` (or we show ETA only from `ride.updated`). |

## The frontend adapts (no backend change needed)

| Area | Spec | Frontend expects | Adapter action |
| --- | --- | --- | --- |
| Statuses | 7 statuses; no `REQUESTED`, `DRIVER_EN_ROUTE`, `DRIVER_ARRIVING`, `PAUSED` | 11 | Treat the spec's set as a subset; `DRIVER_ASSIGNED` shows the en-route UI; "arriving" derived client-side from distance. |
| Estimate response | no `estimateId`, `paymentMethods`, `defaultPaymentMethodId`; option `fare` is plain Money; `etaSeconds`; extra `surgeMultiplier` | `FareQuote { total, range, breakdown, isEstimate }`, `pickupEtaSeconds` | Map Money → `total`; hide range/breakdown; hard-code payment methods to cash. **Product note:** without `estimateId` the request isn't tied to the quoted price, so the fare charged could differ from the one shown. |
| Request body | `optionId, pickup, destination, paymentMethod: "cash", passengersCount` | `estimateId, optionId, paymentMethodId, pickup, destination` | Map fields; send `passengersCount: 1`. |
| Place | `{ name, point }` | `{ id, name, secondary, point, source }` | Strip extra fields on send, fill defaults on receive. |
| Driver channel | Drivers are auto-registered on connect; no `driver` channel | `subscribe { channel: "driver" }` | Stop sending it for this backend (confirm the server ignores unknown channels rather than closing the socket). |
| Availability | `PUT { online }`; GET/PUT response shapes not given; no `ON_TRIP` exposure | `{ availability: OFFLINE \| ONLINE \| ON_TRIP }` | Map once the response shape is known (small ask). |
| SOS body | `{ triggerLocation: { point, recordedAt } }` | `{ type, location, occurredAt }` | Map; SOS type dropped unless backend adds it. Keep SOS flag off until a safety desk exists. |
| Heartbeat | Server pings every 20 s; 45 s read timeout | App pings every 25 s | Compatible. |
| WS path | `/rides/ws` or `/api/v1/rides/ws` | env var | Set `NEXT_PUBLIC_PAID_RIDES_REALTIME_URL`. |

## Not in the spec (hide or flag off for v1)

Chat (3 endpoints + `chat.*` and typing events), rating (`POST /rides/{id}/rating`), ride history (passenger and driver), `GET /rides/{id}`, `ride.sos.acknowledged`, shared-ride fields, share-link and safety-report request/response bodies. The frontend can hide each behind a flag; rating and history are the ones riders will notice missing.

## Open decisions (R§8): what the spec settles

| # | Decision | Status from the spec |
| --- | --- | --- |
| 1 | Cancellation fees | Open. Not mentioned. |
| 2 | Driver sees destination before accepting | **Settled: yes** (offer includes `destination`). |
| 3 | Trip PIN | **Inferred off** (`/start` takes no body). |
| 4 | Masked calling | Open, and the spec currently leans the wrong way (raw phone numbers, see B1). |
| 5 | Payment at launch | **Inferred cash only** (`paymentMethod: "cash"`, no payment status). Failed-payment handling still open. |
| 6 | Offer timeout, radius | **Timeout settled: 20 s.** Radius uses H3 cell + rings; step size and cap not stated. |
| 7 | Retention of location/chat | Open. |
| 8 | SOS desk and SLA | Open; SOS endpoint exists but no acknowledgement path. |

Also note: the example offer has `driverEarning` equal to `fare` (no platform cut). Confirm whether that's real or placeholder data.

## Other things worth knowing

- Fleet API (`/api/v1/cars`, admin) is where vehicles come from; there's no admin UI for it in the frontend yet.
- Examples use Lagos coordinates; the frontend's defaults are Abuja. Harmless, but test data should match the launch city.
- Base URL is `localhost:9990`; integration needs a reachable HTTPS/WSS staging URL.
