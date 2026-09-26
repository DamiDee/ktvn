# Free Buses — reusable routes and Sunday trips

Updated 26 September 2026, starting from the user's clean checkout at `21f2409`. The latest supplied Downloads/openapi.json has been copied into `public/openapi.json`. No production data or account roles were changed.

## User experience

- Admin tables have a shared framed layout, clear column headings, search, sorting, 10/25/50-row pagination, and responsive cards. Activity retains its existing 25-record server pager, without a second client pager. List counts describe the records returned by the API, not an undocumented server-wide total.
- “People” navigation and account headings are now “System Users.” Gold primary actions, selected navigation, filters and form accents are consistent in light and dark themes. Green remains intentional for success states and the forest brand surfaces.
- Boarding controls are compact buttons in one wrapping row: Scan passes, Search manifest, QR Camera and NFC tag. Permission/startup gestures for camera and NFC remain necessary.
- A Route describes reusable locations, stops, instructions, distance and fare. A Trip describes one departure, arrival, direction and operational status. Creating another departure never recreates its route.
- Members can book **on any day for a Sunday departure in Abuja/WAT**. `NEXT_PUBLIC_FREEBUS_SUNDAY_ONLY=true` is the default. Setting it to `false` and rebuilding permits other travel days in the UI. The admin Trip form follows the same policy.
- A member's ticket is linked to `trip_id`, as well as `route_id` and `bus_id`. Duplicate checks and boarding validation are trip-specific; last week's pass cannot board this week's bus even when its route is identical. Legacy tickets without a trip assignment cannot be scanned into the new flow and need backend migration/reissue.
- Times are displayed in WAT. Although OpenAPI declares `date-time`, the deployed trip parser rejects `+01:00` with `departure_time: trailing input`. Trip forms therefore convert WAT to UTC and send `YYYY-MM-DDTHH:mm:ss` without a timezone suffix for both creation and editing. For example, 10:00 WAT is sent as `09:00:00`, not `10:00:00`. API timestamps without a timezone are interpreted as UTC on reading, preserving the round trip. Confirm this UTC convention with the backend before migrating old records; the parser error alone does not document its timezone semantics.

## API methods now used

| Action | Method / path |
| --- | --- |
| Create a reusable route | `POST /routes` → single Route |
| Edit/delete a reusable route | `PATCH` / `DELETE /routes/{id}` |
| List/create trips | `GET` / `POST /trips` |
| Edit/delete trip | `PATCH` / `DELETE /trips/{id}` |
| Start/complete/cancel trip | `PATCH /trips/{id}/start`, `/complete`, `/cancel` |
| Assign an unassigned bus | `POST /buses/{id}/assign-trip`, body `{trip_id}` |
| Change/clear bus assignment | `PATCH /buses/{id}/trip`, body `{trip_id}` or `{trip_id:null}` |
| Reset fleet | `POST /buses/reset-trips` |
| Reserve seat | `POST /bookings`, body `{bus_id, route_id, trip_id}` |
| Refresh expired access | `POST /auth/refresh`, cookie credentials and body `{}` |

The old `/assign-route`, `/route`, `/reset-routes` and `/routes/{id}/complete` calls are no longer made. Activity filters include all six Trip events from the new schema.

## Session renewal

An authenticated request returning 401 triggers one shared refresh per browser tab, then replays that request once. Concurrent and staggered 401s reuse that refresh. Login/registration failures and permission errors (403) do not trigger refresh loops. Refresh uses the existing HttpOnly cookie; no access or refresh token is put in localStorage. Only the non-secret account ID is remembered.

Refresh is bounded to 15 seconds. Invalid/expired refresh (401), inactive account (403), or a replayed 401 clears the remembered identity. Temporary network/server failures do not. Mutations are not replayed after a network error or timeout because they might already have succeeded. API cookie expiry, CORS, browser cookie policies and cross-tab token rotation still need live acceptance testing; the frontend cannot keep a revoked or expired refresh session alive indefinitely.

## Coordinator access and backend follow-up

Route Coordinators land on Bookings & boarding. Only that module and a read-only Buses module are reachable in the live shell; direct URLs to oversight modules are blocked. They cannot manage routes, trips, points, accounts or audit logs, and the manifest does not fetch the global user list. They can scan a signed pass or board a booking by reference using the normal verification flow.

The provided API contract is not yet sufficient to promise the entire requested behavior in production:

1. Manifest listing, booking verification and boarding still document **Admin/Root-only** access. The backend must grant appropriately scoped coordinator access to bookings, booking details, QR verification and boarding, and enforce bus/trip assignment boundaries. Names for the manifest should come from a scoped passenger projection, not global user-directory access.
2. There is no member trip-request or recurring-trip endpoint. The implemented supported workflow is create the route once, then schedule dated trips as admin. Automatic weekly publication or a member request when no trip exists needs a backend endpoint/job and rules. The UI does not fabricate a successful request.
3. Sunday-only travel must also be enforced by the backend using Africa/Lagos time. A UI environment flag is not a security or business-rule boundary.
4. The booking 400 description still mentions one active booking **per route**. Confirm uniqueness is per member and trip, so a member may reserve another Sunday's departure on the same route. Enforce seat allocation transactionally, and validate the booking's route, trip and current bus assignment together.
5. Confirm pagination serialization (`page` and `size` from the schema; some prose says `limit`), cookie rotation and legacy ticket migration against staging.

## Verification

Unit tests cover Sunday/WAT boundaries, repeated trips on one route, trip-specific boarding, role access helpers, refresh coalescing/replay/failure cases, and the updated OpenAPI endpoints. Type checking, lint and the production build were run. No live backend writes were used. Browser launch was not approved, so visual rendering and camera/NFC hardware were **not** tested in this session.
