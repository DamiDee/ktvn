# Scheduled trips frontend

## Local demo

Run the development server, then open `/demo/schedule-trip` on localhost. This
standalone preview needs no backend login and includes Passenger, Driver and
Admin preview buttons. Integrated entries are `/rides/schedule`,
`/rides/driver/schedule` and `/admin/scheduled-trips`.

The demo runs only when BOTH conditions hold: the Next.js environment is
`development` and the browser hostname is localhost, 127.0.0.1 or IPv6 loopback.
Production, including production builds served on localhost, always renders
Coming soon on the integrated routes. The standalone preview returns 404 in
production. No public feature flag can enable production simulation.

1. Preview Passenger and schedule a future pickup/destination/date/time.
2. Preview Driver: the new request appears in the demo notifications and list.
3. Select Demo Driver A or B and accept. The first acceptance reserves that
   driver; it does not immediately dispatch a live ride.
4. Preview Admin: the accepting driver, acceptance time and schedule status are
   visible. Passenger also receives an acceptance notification.
5. Simulate next departure. Due reserved trips become MATCHED and both parties
   receive demo notifications. An unclaimed trip remains awaiting a driver.
6. Passenger may cancel an open/reserved trip. Cancelled trips cannot be claimed
   or matched. Reset demo restores fictional fixtures and the real-time clock.

All entered times are Abuja/WAT (+01:00), independent of browser timezone.
Notifications are in-app demo events, not real web/native pushes. No backend,
real ride, payment, location or account mutation is made by the scheduling demo.
The simulation clock advances explicitly; due reservations also reconcile with
wall-clock time while the page is open. It is not a background dispatch worker.

Demo state is separate from real sessions in localStorage under
`krides-scheduled-trip-demo-v1`. Web Locks serialize mutations across tabs,
re-reading the winner inside the lock before accepting. Storage events synchronize
views. Unsupported Web Locks or unavailable storage produce an error instead of
pretending a reservation succeeded. This is a local demonstration of the workflow,
not a replacement for backend atomicity. Reset clears only the disposable demo.

## Backend integration to add later

Keep the UI behind Coming soon until these are implemented and verified:

- Persist a schedule with owner ID, timezone-aware departure instant, validated
  pickup/destination places and coordinates, passenger count/product and policy.
- Notify eligible drivers when a schedule is created. Use authenticated events
  and durable push delivery; do not rely on an open browser tab.
- Atomically claim an OPEN schedule in a database transaction/CAS. The first
  successful driver wins; a competing acceptance receives 409 and the current
  projection. Validate approved driver/vehicle, time overlaps and availability.
- Accepting ahead of time means RESERVED. A durable, idempotent worker promotes
  it at departure to a normal paid-ride assignment; no duplicate live rides,
  even if the worker retries or two workers execute. Recheck driver eligibility,
  online presence and cancellation state; define no-show/reassignment behavior.
- Passenger can list/cancel their own schedules; drivers receive eligible offers
  and their own reservations; Admin/Root can list/search all schedules and see
  accepted driver, timestamps, status, audit trail and resulting ride ID.
- Return authoritative versions/status and reconcile over the existing
  authenticated WebSocket. Define cancellation deadlines, reservation release,
  notifications, fare estimates and final pricing. The frontend must never
  settle payment or change presence by pretending a local match is a live ride.
- Replace `demo-store.ts` behind a service adapter. Do not connect the demo's
  fictional identities/storage directly to live account or dispatch endpoints.

Suggested future endpoints (design proposal, NOT calls implemented by this UI):
`POST /scheduled-trips`, `GET /scheduled-trips/mine`,
`POST /scheduled-trips/{id}/cancel`, `GET /driver/scheduled-trips`,
`POST /driver/scheduled-trips/{id}/accept`, `GET /admin/scheduled-trips`.

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

- Scheduled-trip domain tests cover local-only gating, validation, notification,
  competing acceptance, delayed matching, cancellation and clock ordering.
- Registration tests verify mandatory bank name, trimmed value and top-level
  bank payload with the leading zero preserved in the account number.
- Browser preview verified passenger creation, immediate driver inbox event,
  acceptance by Demo Driver B, admin visibility and matching at departure.
- Screenshot: `previews/scheduled-trips-demo.png`.
- Production Webpack build and TypeScript passed; lint checks passed.
- 68 focused registration, signup, upload preparation, paid-ride and scheduling
  tests passed. The generated production `/demo/schedule-trip` response has
  HTTP status 404 and contains no demo interface. Integrated production routes
  are present and guarded by the development-plus-loopback policy.

OSRM deployment is separate. SSH host identity was verified by the owner, but
login was rejected by the VPS. Its resources have not been read and it has not
been modified. See `../deploy/osrm/README.md` for a read-only Hostinger check.
