# Free Buses API integration

## Local use

Live mode is the default. Run `npm run dev`, visit `/signup` or `/login`, and use a real member or admin account. Registration now collects the API's required username, address and country; NIN is not collected. Successful registration goes to login. Member login opens `/passenger/free-buses`; Admin/Root login opens `/admin/free-buses`.

This workspace has a git-ignored `.env.local`. Copy the settings from `.env.example` for another installation. There is no server-side secret to manage: the app holds no session of its own.

- `NEXT_PUBLIC_FREE_BUSES_MODE=live`: real authentication and Free Buses screens; other modules are not exposed as live functionality.
- `NEXT_PUBLIC_FREE_BUSES_MODE=demo`: original isolated demo, including simulated automatic departure/notifications. Restart the development server after changing modes; rebuild for production.
- `NEXT_PUBLIC_FREEBUS_API_BASE_URL=https://api.freebus.cloud/api/v1`: the API the browser calls directly. Public by necessity. The backend confirmed the `/api/v1` prefix on 24 September 2026; the exported OpenAPI document still carries no `servers` entry, so the prefix comes from the backend owner rather than the schema.

## Live-server finding, 24 September 2026 (WAT)

A single labelled test-member registration was attempted at `/api/v1/users/register` and returned HTTP 400 with `Could not extract token.` No successful account was created and no booking or fleet records were changed. The frontend displays this failure rather than pretending registration succeeded.

## Contract cross-checks

### First export (28 operations)

- The document had no `servers` entry and no authentication operations at all, and the
  failing registration call used a `/api/v1` prefix the schema did not show. The prefix
  has since been confirmed as correct by the backend owner; treat the missing `servers`
  entry as a schema omission.
- **The registration body was already correct.** `CreateUserDto` requires exactly
  `first_name`, `last_name`, `email`, `username`, `phone`, `address`, `country`,
  `password`, and the gateway validates exactly those eight. Nothing is missing from the
  payload. Account creation returns a bare `UserDto` rather than a `Message_*` envelope;
  the gateway accepts both shapes.
- **Session validation is legitimate for members.** `GET /users/{user_id}` is documented
  as "Admin or Root role, **or an authenticated user retrieving their own record**", which
  is exactly how the gateway resolves a session.
- **Confirmed correct:** route creation sends all ten required `CreateRouteDto` fields and
  reads the `[outbound]` / `[outbound, return]` array the endpoint returns; booking sends
  only `bus_id` and `route_id`; "mark departed" uses `PATCH /buses/{id}/state` with
  `Transit`, the nearest state the `BusState` enum offers; `RoleType`, `BusState`,
  `BusStatus`, `BookingStatus`, `PaymentStatus` and `RideType` match the generated types
  member for member; `GeoPoint` latitude and longitude are strings, as sent.

### Second export (46 operations), 24 September 2026

- **Authentication is now documented and matches this integration.** `POST /auth/login`
  takes `LoginPayload` `{ user, password }` and returns `Message_LoginResponseDto`
  (`data.user`, `data.token`, `data.refresh_token`, `data.token_type`) — exactly what the
  gateway sends and reads. `POST /auth/logout` takes no body and returns `Message_String`.
- **Login also sets upstream `access_token` and `refresh_token` HTTP-only cookies.** The
  gateway ignores those `Set-Cookie` headers and instead reuses `data.token`, sending it
  as both `Authorization: Bearer` and a `Cookie: access_token=…` header on every
  authenticated call, so either server-side scheme is satisfied. Nothing from the upstream
  session reaches browser JavaScript either way.
- **No session endpoint is needed.** Login and logout are the only auth operations the
  app calls. Identity on a reload is `GET /users/{own id}`, authorised by the API's cookie.
- **Public sign-up is `POST /users`** per the backend owner. This path is not in the
  exported document (which still lists `POST /users/register`), so a 404 here is the first
  thing to check if registration fails.
- **Bus assignment restored to `POST /buses/{bus_id}/assign-route`**, now documented with
  `AssignBusToRouteDto` `{ route_id }`. It is preferred over `PATCH /buses/{bus_id}/route`
  because it refuses a bus under maintenance and a completed route; the PATCH form stays
  in the allowlist because only it accepts a null id to unassign.
- **New and not used:** `GET /logs` and `GET /logs/{log_id}` (audit trail, Admin/Root).
  Not proxied. They would be the basis of an oversight activity view later.
- **Still absent:** any token-refresh or password-reset operation. A local session lasts
  up to eight hours and then requires signing in again.

## Connected functionality

- Public registration; email/username login; logout; authenticated profile/session checks.
- Member route search by name, Pickup/Dropoff direction, date and boarding/destination point.
- Fleet availability and booking history refresh every 10 seconds while open. Errors do not fall back to demo data.
- Book an available bus using the API's automatic seat allocation; show number plate, assigned seat and booking reference; cancel a confirmed reservation.
- Admin point creation (real coordinates and landmarks), bus registration (real plates and capacities), zero-fare route creation and assignment of selected registered buses.
- Independent outbound/return schedules so the home drop-off may differ from the original pickup.
- Admin passenger manifest, confirm boarding, and explicitly mark a bus departed.
- Partial route saves are surfaced: if route creation succeeds but some assignments fail, finish from “Assign a bus” rather than creating the route again.

## Architecture: the API owns the session

The browser calls `https://api.freebus.cloud/api/v1/*` directly. There is no proxy, no
server-side session and no signing secret in this app.

`POST /auth/login` sets the API's HTTP-only `access_token` and `refresh_token` cookies.
Every later request uses `credentials: "include"`, so the browser returns those cookies
and the API extracts the token from them. No token is read, stored or sent by application
code — `grep -rn token src/features src/stores` finds nothing. `POST /auth/logout` clears
the cookies.

The signed-in user's **id** — not a token — is kept in `localStorage` under
`kr-freebus-user`, so that after a reload the app can ask `GET /users/{id}` who it is
talking to. That id is not a credential and grants nothing: the request still needs the
cookie, and the API refuses any id but the caller's own unless they are Admin or Root. The
**role the app obeys comes from that server response**, never from storage.

### What the backend must provide

Because this is a cross-site call, the API has to opt in explicitly:

- `Access-Control-Allow-Origin` must echo this app's exact origin. It cannot be `*` —
  wildcards are rejected for credentialed requests.
- `Access-Control-Allow-Credentials: true`.
- `Access-Control-Allow-Methods` covering `GET, POST, PATCH, DELETE` and
  `Access-Control-Allow-Headers` covering `Content-Type`, with `OPTIONS` preflight
  answered on every path.
- Cookies set `SameSite=None; Secure`, which requires HTTPS on both sides.

If any of these is missing the browser reports a network failure with no status, and the
app shows "We couldn't reach the Free Buses service" rather than a specific error. That is
the first thing to check when nothing loads. Note also that `SameSite=None` cookies are
blocked by default in Safari and by Chrome's tracking protections for some users; a
first-party proxy is the only way to avoid that class of failure.

### What moved to the backend

Removing the proxy removed a second line of defence. These are now **only** enforced by
the API, and must be:

- **Role rules.** Only `User` may book; only `Admin`/`Root` may administer; `Driver` and
  `RouteCoordinator` must be neither. The app hides what a role cannot use, but anyone can
  call any endpoint from the browser console.
- **Ownership on bookings.** `CreateBookingDto` accepts an optional `user_id`. The app
  never sends it, but the API must ignore or reject it for non-admins, or one member can
  book a seat as another.
- **Destructive operations.** `DELETE /users/{id}`, `POST /buses/reset-routes`,
  `POST /buses/{id}/reset`, `DELETE /routes/{id}` and the rest were unreachable through the
  proxy and are now reachable from any signed-in browser. Role checks are the only thing
  stopping them.
- **Zero-fare routes and one-seat-per-route.** Both are now UX prechecks in the browser,
  checked again by the API or not at all.
- **CSRF.** A strict origin allowlist is what stops a hostile site making credentialed
  calls; a permissive CORS configuration removes that protection entirely.

Session lifetime is now whatever the API's cookie and token say. The app no longer caps it
at eight hours.

## Remaining backend/product gaps

- **Church service identity:** no structured service-event identifier. Admin route names use `Koinonia Sunday Service` or `T.G.A`; the service filter searches these names. This is a naming convention, not a new backend field.
- **Booking uniqueness:** a duplicate on the same route is checked before submitting, but cross-tab/cross-device uniqueness must be enforced by the backend. One seat across different routes of the same service/direction cannot be enforced reliably without a service identifier and database constraint.
- **Concurrency:** backend documentation promises a row lock per bus. This must still be tested against the real service. The frontend does not automatically retry writes after a timeout because a response may be lost after a successful commit. Check boarding passes/existing routes before retrying.
- **Departure:** bus-full and bus-departed are distinct in live mode. No automatic departure transition is documented; an admin confirms departure. Capacity, availability and departure counts update through polling.
- **Notifications:** no broadcast/push endpoint is documented. No fabricated “everyone was notified” message is shown.
- **Fleet lifecycle:** a bus has only one current route. Fleet resets/reuse can affect occupancy and historical tickets; destructive resets are intentionally not included. API support for per-trip bus allocations is needed for long-term fleet reuse and future scheduling of the same bus.
- **Pagination:** the `Pagination` schema is `{ page, size }` and is nested inside each
  query DTO, while `GET /bookings/me` prose says `page` and `limit`. Neither the winning
  field name nor the query-string serialization of a nested object is settled, so this
  integration omits pagination rather than inventing one. Confirm before production.
- **Sign-up path:** `POST /users` is used on the backend owner's instruction but is not in
  the exported schema. Have it added, and confirm it is exempt from the auth layer.
- **Token refresh:** `refresh_token` is returned at login but no refresh endpoint exists,
  so it is discarded. Sessions end rather than renew.

## Verification

`npm run test:free-buses` runs domain, registration, query and role-policy tests.

The gateway integration suite has been removed along with the gateway. What it covered —
token privacy, query forwarding, permissions, CSRF — is either structural now (no token
exists in this app to leak) or belongs to the API. Remaining behaviour can only be proven
against the real service, once CORS and cookies are configured.
