# Paid Rides admin: live integration

The Paid Rides admin workspace (`/admin`, except `/admin/free-buses`) reads and writes the backend admin API described in [PAID_RIDES_ADMIN.md](./PAID_RIDES_ADMIN.md) (copy of the backend's doc, 19 Oct 2026) and the OpenAPI contract in [openapi.json](./openapi.json).

## How it is wired

- `src/features/admin/data/admin-data.ts` is the only data source the admin screens use. `NEXT_PUBLIC_PAID_RIDES=api` (the default whenever Free Buses is live) talks to `/api/v1/admin/*`; `mock` keeps the demo records and shows the "preview" label, as before.
- `admin-api.ts` sends requests through the shared session client, so the HTTP-only `access_token` cookie and the one-time refresh work exactly as in the rest of Paid Rides. Admin `{ code, message }` errors become toasts.
- `admin-wire.ts` maps the API's camelCase JSON onto the existing view models in `src/types/models.ts`. Ride statuses go through the same table as the passenger and driver apps (`DRIVER_EN_ROUTE` and `DRIVER_ARRIVING` → approaching, `PAUSED` → in progress). It is pure; `tests/admin-wire.test.mjs` covers it.
- `admin-socket.ts` connects to `/rides/ws` with the cookie, subscribes to `admin:rides` and `admin:safety` (plus `ride:{id}` while a ride page is open), pings every 25 s and reconnects with the paid-rides backoff. Every event is a refetch hint; a reconnect or `admin.resync_required` refetches everything. Live rides, the overview and the active SOS also poll every 12 s.
- The SOS banner now shows on every Paid Rides admin page in both shells.

## Actions that now persist

Flag and clear flag, deactivate (with the reason the driver sees), reactivate (`PATCH /users/{id}/activate`), and schedule inspection on driver records; restrict, lift restriction and membership re-check on member records; start review, resolve, reopen, notes and logged calls on incidents; acknowledge and resolve SOS on a live ride; verify or flag documents, comments, inspection, approve, request changes and reject (now with a required reason) on applications; clear quality flags; CSV export of reports (a download, not email). Uploaded documents preview inline when the API returns them.

## Where the API doc and the screens don't line up

1. **Untyped parts of the spec.** `docs/paid-rides/openapi.json` (updated 19 Oct with the `/admin/*` routes) types the list pages, `AdminRideSummary`, `PersonSummary`, `ApplicationSummary`, `Application`, `ApplicationDocument`, `Incident`, `SosAlert`, `Overview`, `Metric` and `ReportSection`, and the mappers follow those names. These are still `{}` in the spec and are read defensively: the bodies of `GET /admin/rides/{id}`, `/admin/drivers/{id}`, `/admin/passengers/{id}` and `/admin/quality-flags`; the nested `driver`, `passengers[]`, `sos`, `pickup`/`destination`, `inspection`, `licence`, `affiliation`, `participants[]`, `timeline[]`, `adminNotes[]` and `comments[]`; the `counts` object; and the responses of notes, comments, calls, decision and inspection. `ReportSection` has no title or series item type, so titles come from the client. Typing those would remove the remaining guesswork.
2. **Single-value filters.** "In review" spans three application states, "Inspection" two, and the incidents "High and critical" chip two severities. The client sends one request per value and merges them. Accepting comma-separated values would make this one request.
3. **Only the first 100 rows.** Lists request `limit=100` and do not page further yet. Totals and chip counts come from the server. "Not yet approved" drivers and "Not yet confirmed" members are narrowed on the client within those rows.
4. **Document type name.** The API's `ROADWORTHINESS_CERTIFICATE` is the screens' `ROADWORTHINESS`; mapped both ways.
5. **Reasons the UI doesn't ask for.** Flagging a driver and restricting a member send a fixed reason because the screens have no reason field. Deactivation sends the reason the screen already composes.
6. **Rates.** It isn't stated whether rates are fractions or percentages; values of 1 or less are shown as fractions × 100.
7. **No conversation channel.** "Open conversation" on the quality board is hidden in live mode.
8. **No shared rides.** The "Shared" live-rides chip is always empty in live mode; every ride shows one passenger.
9. **"Both" track drivers** appear in this workspace; volunteer-only records are hidden on the client, so server totals may include them.
10. **Missing ratings** are shown as 0.0 in rosters and on records, because the view model's rating is a number.
11. **SOS "responding".** The doc's active filter includes it, but no route sets it.

Not verified against a running backend or in a browser. Typecheck, lint, all unit tests and the production build pass.
