# Free Buses modules — 25 September 2026

> Historical implementation notes. The route/assignment API and session behavior below are superseded by [the 26 September trip migration](./trip-migration.md).

The existing checkout (commit `86506e1`) was re-read before implementation. The user's `public/openapi.json` is preserved. The published [OpenAPI document](https://api.freebus.cloud/api-docs/openapi.json), fetched on 25 September, is newer and adds signed QR generation and verification.

## Navigation

- Admin/Root: `/admin/free-buses` (overview), then `/buses`, `/routes`, `/points`, `/boarding`, `/activity` under that path.
- User: `/passenger/free-buses` (find/book), `/passenger/free-buses/passes` (history), `/passenger/free-buses/passes/{id}` (ticket), `/passenger/profile`.
- Existing cookie-based authentication and demo screens are preserved. A forbidden operation (403) no longer erases the remembered identity; an expired session (401) still does.

## API methods

| Action | Method and path |
| --- | --- |
| Register / edit / delete bus | `POST /buses`, `PATCH /buses/{id}`, `DELETE /buses/{id}` |
| Reset one / entire fleet | `POST /buses/{id}/reset`, `POST /buses/reset-routes` |
| Assign / change / clear route | `POST /buses/{id}/assign-route`, `PATCH /buses/{id}/route` (`route_id: null` clears) |
| Capacity / occupancy | `PATCH /buses/{id}/capacity` (`capacity`), `PATCH /buses/{id}/allocation` (`passenger_count`) |
| Clear occupancy | `POST /buses/{id}/clear-allocation` |
| State / availability | `PATCH /buses/{id}/state`, `PATCH /buses/{id}/status` |
| Create / edit / delete route | `POST /routes`, `PATCH /routes/{id}`, `DELETE /routes/{id}` |
| Complete route | `PATCH /routes/{id}/complete` |
| Create / edit / delete point | `POST /points`, **`PATCH /points?id={id}`**, **`DELETE /points?id={id}`** |
| Activity list / detail | `GET /logs`, `GET /logs/{id}` |
| My passes / booking | `GET /bookings/me`, `GET /bookings/{id}` |
| Signed QR PNG | `GET /bookings/{id}/qrcode` → `booking_id`, `booking_ref`, `qr_code_base64` |
| Verify scanned content | `POST /bookings/verify` with `{ qr_payload: rawScannedText }` |
| Board verified booking | `PATCH /bookings/{id}/board` |

Activity filters use `user_id`, `activity_type`, `target_id`, and `target_type`. Pagination uses `page` and `size`, the properties of the OpenAPI `pagination` object with its default form/explode serialization. Confirm deployed pagination with the backend: some operation descriptions instead mention `limit`. Names fall back to actor IDs when user records are inaccessible; logs come from the server, never a fabricated frontend audit trail. Sensitive credential/QR/identity keys in structured details are redacted.

Reset, deletion, and operational overrides require explicit confirmation. Reset/clear-allocation must not be used to cancel tickets; these are separate API operations. Server-side integrity checks remain authoritative.

## Boarding

Booking success opens the passenger's pass. It includes the backend's signed PNG, passenger name, assigned seat and bus, route, separate origin/destination, departure in WAT, meeting landmark, instructions, distance, reference, payment and booking status. No NIN, auth tokens, or unnecessary profile data is included. A printed pass can become stale: the scanner always verifies current server state.

The boarding team selects a bus and starts QR or NFC once. For each scan the app:

1. Sends the exact scanned payload to `/bookings/verify`; it does not trust embedded fields.
2. Loads current booking, bus and route records.
3. Rejects invalid, cancelled/revoked, already-boarded, unpaid, wrong-bus/route, completed-route and closed-bus tickets.
4. Calls `/board` and reports success only after a `Boarded` response.

One scan is processed at a time. Repeated reads are throttled and completed bookings remembered for this station session. Mutations are never automatically retried after a network failure. Backend transactional duplicate prevention is still required across multiple devices. The operator can use the manifest/reference fallback after checking the passenger's details. Camera tracks and NFC scanning stop when leaving the screen, hiding the tab, stopping or changing modes.

### NFC limits

[Web NFC](https://developer.chrome.com/docs/capabilities/nfc) reads/writes physical NDEF tags in supported Android Chrome devices. It does **not** provide phone-to-phone transfer, iPhone Web NFC, wallet passes, or card emulation. HTTPS and a user gesture/permission are required, so completely zero-tap startup is impossible.

Admin can prepare a blank tag from the passenger's backend-signed QR. The image is decoded locally, and the exact signed payload is written as an NDEF text record. Existing tag data is not overwritten. NFC reads use the same server verification and boarding checks as QR. No invented NFC API is used. Treat each tag as a bearer ticket, not proof of identity. Physical camera and NFC hardware still need on-device acceptance testing.

## Maps and route distance

Chida searches (Center/Centre) resolve to the supplied first pair: `9.07081, 7.43461`, labelled community-supplied. Admin can adjust the pin or coordinates for the actual boarding entrance.

`GET /api/route-distance` requests an OSRM driving route through origin, ordered stops, and destination; returned metres are converted to kilometres and populated in the form. Old endpoint results cannot populate a newly selected route. Missing/failed routing never silently substitutes a straight-line distance or zero; retry or enter a verified distance manually. Configure `ROUTING_API_BASE_URL` for a dedicated production routing service—the public demo has no production SLA. Only public stop coordinates are sent, not member locations.

## Verification

- Unit tests cover boarding eligibility, QR image safety, Chida aliases and coordinate ordering/validation.
- Isolated browser checks use synthetic records and intercept every Free Buses API request. No real account credentials or live data mutations are used.
- Live production permissions, pagination, concurrency across boarding devices, routing-provider reliability and physical NFC/camera performance need a staging/on-device check before rollout.
