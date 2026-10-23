# Scheduled trips frontend

The supplied backend contract is preserved in
[`paid-rides/SCHEDULED_RIDES_FRONTEND.md`](paid-rides/SCHEDULED_RIDES_FRONTEND.md).
It is the workflow reference; the newer supplied `/Users/user/Downloads/openapi.json`
confirms the endpoint definitions and optional response fields. The earlier
proposed `/scheduled-trips` endpoints are obsolete.

## Page styling

Scheduling uses the same shared cards, form inputs, segmented controls, status
chips, route stops and empty states as the rest of the app. Booking cards group
pickup time, route, locked fare and driver assignment, with additional details in
an expandable section. Admin previews add a compact summary and responsive card
grid. Local simulation controls are expandable, while the demo label remains
visible. API lists use the existing animated skeleton treatment while loading.

## Local simulation

Open <http://127.0.0.1:3017/demo/schedule-trip> with the development server running.
No login is needed. Passenger, Driver and Admin buttons preview fictional roles.
Integrated routes are `/rides/schedule`, `/rides/driver/schedule` and
`/admin/scheduled-trips`.

1. As Passenger, search pickup and destination just as when booking a ride,
   use current location, or choose each stop with a map pin. The shared ride map
   shows both stops and a road route with journey distance/time when available.
   Search and map data use the existing geocoding/routing proxies even in the demo;
   scheduling records and fare quotes remain fictional. No GPS watcher, presence
   update or live ride is started. If road routing is unavailable, selected stops
   remain usable without drawing an approximate line as a road route. Map-pin
   confirmation waits for the map to initialize and finish moving.
   Choose a pickup time one hour to thirty days ahead.
   Get a quote, review a private option and confirm. A fresh quote is obtained at
   confirmation; unavailable-now options can still be scheduled. Shared options
   are excluded. The saved fare is locked, including zero additional waiting fees.
2. As Driver, select Driver A or B and accept an open request. Acceptance includes
   the reviewed version: the first successful acceptance wins. Switch to
   **My reservations and history** to see accepted bookings.
3. As Admin, inspect the assigned driver and booking state. Names are fictional;
   the real API currently returns participant IDs only.
4. Change a pickup time as Passenger: the fare and route stay locked, the driver
   is released and the request requires new acceptance. Cancellation and driver
   release require a reason. Overlap checks include journey duration and buffer.
5. **Simulate activation window** advances to fifteen minutes before pickup.
   A reserved booking becomes ACTIVATED with a fictional live-ride ID. Use
   **Simulate completion** to finish it. **Simulate busy expiry** demonstrates
   deferred activation and expiry after the ten-minute grace period. An unclaimed
   OPEN booking expires at pickup. Reset restores fictional fixtures.

States are OPEN, RESERVED, ACTIVATED, COMPLETED, CANCELLED and EXPIRED. All demo
inputs use Africa/Lagos regardless of device timezone. The demo is a simulation,
not a background worker or real booking, payment, push notification or email.
Reminder delivery and backend worker durability require server-side verification.

Demo storage uses `krides-scheduled-trip-demo-v2`; old v1 fixtures are not reused.
Web Locks serialize cross-tab acceptance and storage events synchronize views.
Unsupported locks or failed storage produce an error rather than a false success.
The simulation clock advances explicitly and reconciles due states while open.

## Local API testing

Default local routes remain simulations. To use actual backend bookings, sign in
with an appropriate test account and explicitly open:

- Passenger: `/rides/schedule?source=api`
- Driver: `/rides/driver/schedule?source=api`
- Admin: `/admin/scheduled-trips?source=api` (uses the same booking list component
  and `GET rides/scheduled` endpoint; no separate admin list is required)

This uses the existing paid-rides API mode, configured API base and shared cookie
session client. It can change real backend data; use test accounts. There are no
automatic mutation retries. An uncertain create keeps the exact estimate and body
for an explicit **Retry same booking**, preserving backend idempotency.

The adapter implements the documented routes relative to the API base:

- `POST/GET rides/scheduled`, `GET/PATCH rides/scheduled/{id}` and passenger cancel.
- `GET driver/scheduled-requests`, including `mine=true` for assigned history.
- Driver accept with `{version}` and driver cancel/release with `{reason}`.

Create sends only `estimateId`, `optionId`, `scheduledAt` and `timezone`. List
filters use only the documented cursor, limit, single status, from/to and driver
mine fields. Dates carry an offset or Z. Loaded results are sorted by pickup time;
server pagination remains UUID-based, so this is not a global chronological sort.
A 409 refreshes the list and requires explicit review before another acceptance.
Older booking versions cannot overwrite newer cached snapshots.

Scheduled events extend the existing shared WebSocket; no second driver mailbox
connection is opened. The supplied contract requires the server-root `/rides/ws`.
For local API testing, configure `NEXT_PUBLIC_PAID_RIDES_REALTIME_URL` to the
backend's root socket URL and restart development. The existing default socket
path is not silently changed for the rest of the app or Android wrapper. Until
that configuration matches, scheduling uses visible-list polling only.

Private `scheduled:{id}` channels are subscribed only for the current participant;
ACTIVATED bookings also subscribe to `ride:{rideId}`. Scheduled frames deduplicate
by event ID, not `seq: 0`. Refetches run after events, reconnect, focus, actions and
conflicts, with ten-second visible polling as fallback. Cleanup removes screen
subscriptions and listeners. The existing five-second application heartbeat stays
in place. API actions do not locally invent activation or completion.

## Production gate and remaining backend checks

Both development mode AND a loopback hostname are required for simulation or API
test screens. Production integrated routes always show **Coming soon**, including
production served on localhost or a URL containing `source=api`. The standalone
`/demo/schedule-trip` returns 404 in production. No public flag enables it.

Before launch, verify the adapter against a deployed backend with test accounts,
including cookie permissions, race/conflict behavior, worker activation and email
and durable notification delivery. The supplied guide names
`rides/me/notifications` but provides no response DTO, and the existing frontend
has no typed inbox adapter; a durable scheduled-notification inbox remains pending
that response contract. WebSocket hints currently refresh booking lists. Demo
notifications are synthetic and must not be treated as delivery evidence.

Admin uses the same scheduled-booking list as the other roles, without requiring
a separate admin endpoint. Driver requests still use the documented driver board.
The API controls record visibility: the current OpenAPI describes
`GET rides/scheduled` as the authenticated passenger's bookings. Reusing that
endpoint for admin does not expand its server-side scope; if everyone should see
all bookings, the backend must implement that shared visibility on the existing
endpoint. No client-side identity override or unprovided query parameter is sent.
Booking actions remain role-specific and passenger changes are limited to owned
bookings. The authenticated driver mine list supplies assignment context when an
optional driver ID is absent. Participant names are not supplied, so real
booking details show authorized IDs when present.

Response parsing accepts omitted `driverId`, `rideId`, `cancellationReason` and
`nextCursor`, normalizing them to null, in every documented state. Missing optional
links do not prevent the list from loading or create fictional assignments/live
ride IDs. Basic checks for required display data, valid dates and amounts remain
so malformed responses cannot display an invented fare or trigger an invalid
booking action. Extra response fields are tolerated. Request validation remains
aligned with the backend's accepted fields. Nullable place metadata (`id`, `secondary`,
`source`) is accepted and normalized for the shared route display. `fare` and
`option` remain arbitrary JSON as documented, including null, objects, arrays or
primitives. Cards display the separate required `total`; they only use an option
name when it is text. Demo quotes retain their own typed model instead of imposing
that synthetic structure on real API responses. New response status strings are
shown with a neutral badge and cannot activate actions intended for known states.


## Bank fields

Driver onboarding now requires Bank name immediately after Account number, and
shows it in the review step. Both `account_number` and `bank_name` are sent on the
main CreateUserDto, matching the supplied OpenAPI, rather than hiding the account
number in driver_details. Passenger signup does not require bank information.
The completed-ride panel already renders bank name, account number and optional
account name from the authorized ride projection. The backend must release these
fields on COMPLETED events and history detail; it must not expose arbitrary user
bank records. See `MOBILE_AND_MAPS_UPDATE.md` for that payload contract.

## Verification

The earlier 77-test integration run passed. Following optional-response and shared
admin-list alignment, the 31 focused scheduling and shared-transport tests passed, including nullable
place metadata and arbitrary fare/option payloads. The route-picker update passed
38 scheduling, transport, routing and map-tile tests plus focused lint checks.
Read-only local HTTP checks returned 200 for Jabi Lake Mall search (two results)
and a Jabi-to-Wuse road route (151 points, 7,601 metres, 516 seconds). They cover scheduling bounds, locked quotes, exact payloads, safe
retries, acceptance races, rescheduling, buffered overlap, activation/expiry,
timezone conversion, monotonic versions, event deduplication and reconnect
subscriptions. The production Webpack build, TypeScript and focused ESLint checks
passed. Generated production
metadata confirms that `/demo/schedule-trip` returns 404.

The current preview has not been visually re-verified: browser access was rejected
by the browser URL security policy. The older screenshot in `previews/` predates
this contract-aligned revision. No real booking was created during implementation.

OSRM deployment is separate. Nigeria road routing is live on the Hostinger VPS
and connected to the hosted app and local preview, verified on 2026-10-23. See
`../deploy/osrm/README.md` for deployment status and operating instructions.
