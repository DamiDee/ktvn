# Member and boarding update — 30 September 2026

Based on the current local checkout (`517b730`) and the supplied
`/Users/user/Downloads/openapi.json`. Existing City and boarding-animation work is
preserved. The supplied contract is the authority for request methods and bodies;
the frontend does not bypass server permissions or invent unsupported endpoints.
The public API document was also checked: it still exposes no password-change,
child/dependent-booking or strike endpoints.

## Connected changes

- Members get a dismissible introduction, a replayable five-step walkthrough and
  short contextual explanations on their screens. Guide completion is local to
  the member and browser, not a backend membership record.
- Ticket details include the published route stops in their existing order,
  landmarks, and **To church / To home / Round trip** journey labels. Labels come
  from the API trip's `ride_type`, not a local preference.
- Routes → Schedule trip opens the existing trip form in a modal without leaving
  Routes, then uses `POST /trips`. Route/date deep links from ride requests also
  open the trip form immediately.
- Removed the 18-seat demand comparison and the icon before “Room for everyone”.
- Fixed the shared checkbox checkmark/background so selected round-trip flags and
  other checkboxes display visibly in gold. The former SVG-in-class-name used
  whitespace that broke its CSS class.
- The visible activity list polls every five seconds instead of two minutes,
  rechecks on focus, sorts timestamps newest-first within the returned page and
  shows UTC-naive API timestamps in explicit Abuja/WAT with relative ages. Hidden
  tabs stop polling. The page shows its last successful refresh time. The backend
  still determines when events are written and which records are returned; it
  should return newest-first pages and document timestamp timezone semantics.
- Removed the scanner's artificial 12-second request abort. Scanning has no
  session timer, but stops when the user asks, leaves the page, backgrounds the
  tab, or when a response makes further boarding unsafe. Duplicate-scan and
  already-boarded protections remain. Cancelled/completed trips remain closed;
  a scheduled departure timestamp alone does not prevent boarding.

## Walk-in occupancy and seat release

Both Admin/Root and Route Coordinator screens expose boarding controls, but the
attached specification grants the following writes only to Admin/Root:

- `PATCH /buses/{bus_id}/allocation` with `{ "passenger_count": <new total> }`.
- `DELETE /bookings/{booking_id}` to cancel a confirmed booking and free its seat.

Walk-in boarding re-reads the bus and trip, rejects changed/closed assignments,
checks whole-number capacity bounds, then confirms the returned count. It never
automatically retries an uncertain write. An uncertain response requires a count
recheck and physical confirmation. These are **occupancy-only entries**: they do
not create named reservations, assign numbered seats, or issue QR tickets.
People with existing bookings use Manifest → Board to avoid double counting.

Important backend follow-ups:

1. Grant Route Coordinator the intended, preferably assigned-bus-scoped,
   permissions for occupancy, manifest, ticket lookup, verification, boarding and
   cancellation. The UI reports 403; it cannot grant the server role access.
2. Replace absolute-count updates with an atomic increment or conditional/versioned
   operation plus idempotency. Reading before writing cannot remove the race
   between multiple devices or simultaneous member bookings. Until then, use one
   operator for each bus's manual count and reconcile it with the actual boarding.
3. The supplied cancellation endpoint returns `Cancelled`, not `Revoked`, and
   rejects already-boarded tickets. The UI accurately displays the returned state
   and offers release only for confirmed seats. A distinct revoke/boarded-seat
   adjustment policy needs an explicit backend operation.

## Prepared, not live

The supplied API contains no password-change, forgotten-password, child/dependent
booking or strike operation. These features must not report fake success:

- **Change password:** accessible from the member profile. Prepared, disabled
  current/new/confirmation form; no password collection or request. Needs a
  verified authenticated endpoint and password/session policy.
- **Forgotten password:** live mode now shows the prepared recovery page, not the
  old simulated OTP/reset flow. No emails, codes or reset links are claimed sent.
  Needs verified reset-request and token-redemption endpoints with rate limiting.
- **Children:** booking confirmation explains that the existing booking covers
  only the member; child-seat selection is visibly unavailable. Needs an
  authorised guardian/dependent contract, per-passenger seats, atomic capacity
  allocation, child ticket rules and cancellation rules. Repeated self-bookings
  cannot implement this because the current API rejects duplicates.
- **Same-bus return:** an optional checkbox on outbound booking and ticket screens
  saves a device-only flag, scoped to the member and ticket. No unsupported field
  is sent to the API, no return seat is reserved, and coordinators do not receive
  this flag. A separate return booking remains necessary. Actual activation needs
  linked outbound/return legs, same-bus capacity guarantees and boarding per leg.
- **Strikes:** System Users → Strikes opens a disabled review preview for members.
  No offences are stored and no accounts are penalised. Needs backend records,
  authorised review, an audit trail, passenger notice and an appeal process before
  activation. No automatic account deactivation has been introduced.

## Verification

The unit suite covers occupancy bounds and closed/mismatched trips, boarding after
the scheduled time, ordered stops, journey labels, WAT/relative times, and isolated
device-only preferences. Browser verification uses synthetic API responses; no
production users, bookings, bus counts or disciplinary records are changed.
