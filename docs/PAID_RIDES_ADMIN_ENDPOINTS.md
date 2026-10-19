# Paid Rides admin dashboard: endpoint map

What the Paid Rides admin dashboard (`/admin`, excluding `/admin/free-buses`) needs from the K-Ride backend to run on live data, compared against the backend's OpenAPI file.

- Written 19 Oct 2026 against `main` at `d2ded5c`.
- Spec compared: `docs/paid-rides/openapi.json` (k-rides 0.1.0, Rust/Axum, REST under `/api/v1`, socket at `/rides/ws`), plus `docs/paid-rides/API_AND_WEBSOCKET_SPEC.md` for the socket.
- Nothing in this document has been run against a live backend. "Exists" means the path and schema are in the OpenAPI file, not that they were tested.

## 1. Repository state at time of writing

- Branch `main`, up to date with `origin/main`. `feature/paid-rides` (last commit 16 Oct) is fully merged into `main`; `main` has seven newer commits (`fixedDrivers`, `fixedDriversOnboarding`, `addedProgressScreenForDrivers`) covering driver onboarding, driver registration DTOs, document compression, the driver account page and map tiles. None of them touch `src/features/admin`.
- **Two different `openapi.json` files.** The repo-root `openapi.json` (tracked, last changed in `29e71e0`) is the older Free Buses spec: it has no `/rides`, `/driver` or `/cars` paths. `docs/paid-rides/openapi.json` is a strict superset and is the one used here.
- Four untracked files at the repo root: `API_AND_WEBSOCKET_SPEC.md`, `BACKEND_SPEC_ALIGNMENT.md` and `PAID_RIDES_BACKEND_REQUIREMENTS.md` are older copies of the files in `docs/paid-rides/` (the `docs/` versions are newer and longer); `HOW_TO_STUDY_THE_BIBLE_PARTS_1_TO_3.docx` is unrelated.

## 2. How the admin dashboard gets data today

Every admin screen is mock-backed. The data comes from three service objects that resolve fixtures through `request()` in `src/services/api-client.ts`:

| Service | Methods used by admin | Fixture |
|---|---|---|
| `adminService` (`src/services/admin-service.ts`) | `getOverview`, `listLiveRides`, `getLiveRide`, `listIncidents`, `getIncident`, `listQualityFlags`, `listReports`, `acknowledgeSos` | `src/mocks/admin.ts` |
| `userService` (`src/services/user-service.ts`) | `getAdmin`, `listDrivers`, `getDriver`, `updateDriverAccountStatus`, `scheduleDriverInspection`, `listPassengers`, `getPassenger` | `src/mocks/people.ts` |
| `verificationService` (`src/services/verification-service.ts`) | `listQueue`, `getVerification`, `setDocumentStatus`, `addComment`, `scheduleInspection`, `decide` | `src/mocks/verification.ts` |
| `rideService` (`src/services/ride-service.ts`) | `listDriverTrips`, `listRides` (driver and passenger "recent rides") | `src/mocks/*` |

Several actions never call a service at all; they only update local state and show a toast (incident status and notes, passenger restriction, quality "clear flag", report export, "re-check membership", "call"). These are marked **toast only** below.

All filtering and search happens in the browser over the full list. Every screen also drops anything that is not `track === PROFESSIONAL`, so volunteer records are hidden from this workspace.

The admin shell shows "Preview workspace · Demo records and simulated actions" and an SOS banner driven by `overview.activeSos`.

## 3. Summary

| Screen | Route | Live today? | Backend coverage |
|---|---|---|---|
| Dashboard | `/admin` | Mock | **Missing**: metrics, admin live-ride list, active SOS |
| Live rides | `/admin/live-rides` | Mock | **Missing**: admin ride list; socket feed for admins |
| Live ride detail | `/admin/live-rides/[id]` | Mock | **Partial**: `GET /rides/{id}` exists but is participant-scoped and single-passenger; no ids, no SOS detail, no event log |
| Verification queue | `/admin/verifications` | Mock | **Partial**: `GET /users?role=Driver` returns `driver_profile`, but no status filter, no queue view |
| Verification review | `/admin/verifications/[id]` | Mock | **Missing**: per-document status, comments, decision, inspection. Car verify exists via `PATCH /cars/{id}` |
| Drivers | `/admin/drivers` | Mock | **Partial**: user list exists; stats, availability and flag state missing |
| Driver detail | `/admin/drivers/[id]` | Mock | **Partial**: user, car, deactivate and activate exist; stats, trips, flag, inspection and deactivation reason missing |
| Passengers | `/admin/passengers` | Mock | **Partial**: user list exists; ride count, rating, contacts, membership missing |
| Passenger detail | `/admin/passengers/[id]` | Mock | **Partial**: user exists; rides, contacts, restriction missing |
| Incidents | `/admin/incidents` | Mock | **Missing**: SOS and safety reports can be created by riders, but nothing reads or manages them |
| Incident detail | `/admin/incidents/[id]` | Mock | **Missing** |
| Quality | `/admin/quality` | Mock | **Missing** (ratings are written by `POST /rides/{id}/rating` but never aggregated) |
| Reports | `/admin/reports` | Mock | **Missing** |

In short: the user, car and audit-log endpoints cover identity and fleet; everything that is specific to paid-ride oversight (network view of rides, safety, ratings, verification workflow, metrics) is missing.

## 4. Cross-cutting backend questions

These affect every endpoint below and should be settled first.

1. **Admin role and auth.** OpenAPI declares no `securitySchemes`; access rules live only in descriptions ("Bearer JWT with `Admin` or `Root` role"). Auth is the Bearer header or the HTTP-only `access_token` cookie from `/auth/login`. `RoleType` is `Root | Admin | RouteCoordinator | User | Driver`, while `POST /users/admin` mentions an `Inspector` role that is not in the enum. Proposal: every endpoint in section 6 requires `Admin` or `Root`; decide whether an inspector role exists for verification and inspection work.
2. **`GET /rides/{ride_id}` for admins.** It returns `401/403/404` with no description. Confirm whether an admin can read any ride. If not, the admin variant in 6.2 is needed.
3. **Response envelope is inconsistent.** `/users` returns a bare `UserDto[]`; `/cars` and `/logs` return `{ message, data }`; paid-ride endpoints return bare objects. The frontend already copes with both, but new admin endpoints should pick one. Proposal: bare objects with a `{ items, nextCursor }` page shape like `RideHistoryPage`.
4. **Pagination is ambiguous.** The schema shows a query param named `pagination` holding `{ page, size }`; the `/users` description says `page` and `limit`. Confirm the real query string (e.g. `?page=1&size=25`). `RideHistoryPage` returns `nextCursor` but no `cursor` param is documented. Lists also need a total count for the filter-chip counts (see "All (n)" on every list screen).
5. **List payload weight.** `UserDto.driver_profile` carries Base64 document fields (`nin_slip`, `profile_photo`, `licence_photo`, guarantor photo). Returning that for every row of a driver list is heavy. Proposal: list endpoints return a summary without document bodies, and the detail endpoint returns documents (or URLs to them).
6. **Enum mismatches the adapter will need to map.**
   - `DriverTrack`: backend `Volunteer | Professional | Both`; frontend `VOLUNTEER | PROFESSIONAL`.
   - `RideStatus`: backend `REQUESTED, SEARCHING, NO_DRIVERS, DRIVER_ASSIGNED, DRIVER_EN_ROUTE, DRIVER_ARRIVING, DRIVER_ARRIVED, IN_PROGRESS, PAUSED, COMPLETED, CANCELLED`; the admin UI uses the older `src/types/enums.ts` set (`MATCHED`, `DRIVER_APPROACHING`, `NO_MATCH`, `PAYMENT_PENDING`, ...). The paid-rides passenger and driver code already maps the backend set; admin should reuse that mapping.
   - `DriverProfileDto.status` is a free string. The driver app currently treats `approved | verified | active` as approved and `pending | submitted | underreview | inreview` as pending (`src/features/paid-rides/domain/account-profile.ts:90`). The admin verification workflow needs a real enum (see 6.3).
   - `SosView.status` is `none | sent | acknowledged | resolved`; the UI also has `RESPONDING`.
7. **Shared rides.** The admin UI shows "n of 3 on board" and per-passenger drop-offs. `RideProjection` has one `passenger`. If v1 is private rides only, the admin views can show one passenger; otherwise the backend needs a passengers array.
8. **Contact-detail release rule.** The UI promises that driver and passenger phone numbers are "released only while an incident is open". That rule must be enforced by the backend (omit phone fields unless an open incident covers the ride), not just hidden in the UI.
9. **Audit trail.** `GET /logs` exists with `user_id`, `activity_type`, `target_id`, `target_type` filters, but `ActivityType` has no ride, SOS, incident, verification, flag or inspection events. Every admin mutation in section 6 should write an activity log entry, and the enum needs those values.

## 5. Screen inventory

Each screen lists what it shows, its filters and its actions, then which endpoints back it.

### 5.1 Admin shell (all pages)

- Admin name and avatar (`userService.getAdmin`).
- Rail status "SOS active" or "All clear", plus an SOS banner when an SOS is live (`overview.activeSos`).
- **Exists:** current user via `GET /users/{id}` (as the driver account page already does).
- **Missing:** "is any SOS live right now, and which one". Covered by `GET /admin/sos?status=active` (6.5) plus the admin socket channel (7).

### 5.2 Dashboard (`src/features/admin/admin-dashboard.tsx`)

- Four stat cards, each with value, delta % and a 7-point sparkline: Active drivers, Live rides, Pending verification, Open incidents.
- "Live rides" table: driver (name, avatar, ride reference), type, passenger count, ETA, status or SOS chip; rows link to the ride.
- "Network quality" list: Completion rate, Match rate, Average rating, Rides this week, each with delta %.
- Static links to verification and drivers.
- Data: `AdminOverview { primary: AdminMetric[]; secondary: AdminMetric[]; trackDistribution; rideVolume; activeSos }` where `AdminMetric = { id, label, value, display?, deltaPercent?, intent?, series?: number[] }`.
- **Missing:** `GET /admin/overview` (6.1) and `GET /admin/rides` (6.2).

### 5.3 Live rides (`live-rides.tsx`)

- Header: live ride count and rider count.
- Search (client-side): driver name, reference, destination, passenger name.
- Filters: All (n), SOS (n), In progress, Matching, Shared, Private.
- Card per ride: reference, origin → destination, status or SOS, track, ride type, "Arriving in n min", driver name and vehicle (colour, make, model, plate), passenger avatars, "n of 3 on board", passenger names, drop-off labels.
- Data shape `LiveRideSummary`: `id, reference, driverId, driverName, driverAvatarUrl, driverRating, driverTrips, driverPhone?, vehicle, track, rideType, originLabel, destinationLabel, passengerCount, passengers[], status, startedAt, etaMinutes, sosActive, position, heading, route?`.
- **Missing:** `GET /admin/rides?state=active` (6.2) and live updates (7). Today the list is fetched once with no refresh.

### 5.4 Live ride detail (`live-ride-detail.tsx`)

- Journey: from, to, track, type, ETA, start time.
- Driver: name, avatar, rating, trip count, vehicle, link to driver record, phone (incident-gated).
- Passengers: per person name, avatar, rating, drop-off, state (waiting, on board, dropped off, no-show), phone (incident-gated).
- Timeline: requested, matched, in progress, SOS raised, arrival. Built client-side today.
- Safety response card when SOS is active: SOS status, raised by, link to incidents.
- **Partly exists:** `GET /rides/{ride_id}` → `RideProjection` has status, pickup and destination `Place`, route, `driver: DriverView` (name, avatar, rating, completedRides, vehicle, verified, contact), `passenger: PassengerView`, `driverLocation`, `progress`, `timestamps`, `sos.status`, `rating`, `cancellation`.
- **Missing from it for admin:** driver and passenger user ids (to link to records), a human ride reference, passenger state, phone numbers under the incident rule, SOS detail (who raised it, when, type, location), and an event log. Proposed in 6.2.

### 5.5 Verification queue (`verification-queue.tsx`)

- Columns: applicant (name, avatar), track, documents ready (n of m), vehicle, inspection state, submitted date, status.
- Search: applicant name. Filters: All (n), In review (`SUBMITTED`, `DOCUMENT_REVIEW`, `FINAL_REVIEW`), Inspection (`INSPECTION_REQUIRED`, `INSPECTION_SCHEDULED`), Changes required.
- Data `DriverVerification`: `id, driverId, applicantName, applicantAvatarUrl, track, tracks, status, submittedAt, updatedAt, documents[], steps[], inspection, vehicle, statusDetail, changesRequested?, reviewerNote?, comments?`.
- **Partly exists:** `GET /users?role=Driver` returns `UserDto.driver_profile` (`status`, `track`, licence, worker/guarantor, Base64 documents, `car_id`, `created_at`) and `car` id. There is no filter by profile status, no submitted date beyond `created_at`, and no per-document state.
- **Missing:** `GET /admin/driver-applications` (6.3).

### 5.6 Verification review (`verification-review.tsx`, the largest screen)

- Applicant header, track(s), status and status detail, step list.
- Documents: each with type, label, status (`MISSING, UPLOADED, NEEDS_ATTENTION, EXPIRED, VERIFIED`), file name, MIME type, size, upload and expiry dates, reviewer note; preview of the Base64 file.
- Vehicle details and inspection card (required, scheduled time, location, note).
- Review thread: comments with author, time and visibility `INTERNAL` or `APPLICANT`, optionally tied to a document.
- Actions:
  - Verify a document → `setDocumentStatus(verificationId, documentId, VERIFIED)`.
  - Flag a document with a required reason → `setDocumentStatus(..., NEEDS_ATTENTION, note)`.
  - Add comment (internal note or feedback to applicant) → `addComment`.
  - Schedule inspection (date-time, location, instructions) → `scheduleInspection`.
  - Decide: Approve, Request changes, Reject (with confirm dialogs) → `decide`. Approval is blocked in the UI while any document is missing, expired or flagged.
- **Exists:** `GET /users/{id}` (profile and documents), `GET /cars/{car_id}`, `PATCH /cars/{car_id}` with `is_verified` (mark the vehicle verified). `PATCH /users/{id}` can update identity fields; `is_identity_verified` is on `UserDto` but no endpoint sets it.
- **Missing:** everything in 6.3.

### 5.7 Drivers (`drivers-list.tsx`)

- Columns: driver (name, avatar, verified), track, vehicle (make, model, plate), trips, rating, status (availability if approved, else verification status; deactivated; flagged).
- Search: name or plate. Filters: All (n), Online, Not yet approved, Flagged (n), Deactivated (n).
- **Exists:** `GET /users?role=Driver&search=&is_active=` gives name, email, phone, active flag, `driver_profile.status`, `driver_profile.track`, `car` id.
- **Missing:** rating, completed trip count, live availability, flagged state, and the vehicle summary without an extra `GET /cars/{id}` per row. Plate search needs the server to search cars too. Proposed `GET /admin/drivers` in 6.4.

### 5.8 Driver detail (`driver-detail.tsx`)

- Identity: name, avatar, email, join year, track, verified badge, flagged chip.
- Activity: total trips, rating, trips this week, week-to-date earnings.
- Vehicle: colour, make, model, plate, seats, inspected or not; inspection appointment or next due date and location.
- Recent trips (4): destination, reference, ride type, date, fare, status.
- Oversight panel: verification status, NIN verified, Koinonia worker department or guarantor name, pending track switch.
- Actions:
  - Schedule vehicle inspection (date-time, location, note) → `userService.scheduleDriverInspection`.
  - Flag for review → `updateDriverAccountStatus(FLAGGED)`.
  - Deactivate with a reason the driver sees (missed inspection, or oversight review) → `updateDriverAccountStatus(DEACTIVATED, reason)`.
- **Exists:** `GET /users/{id}`, `GET /cars/{car_id}`, `PATCH /users/{id}/deactivate`, `PATCH /users/{id}/activate` (no UI button yet).
- **Missing:** deactivation reason (the deactivate endpoint takes no body), flag and unflag, driver stats and earnings, admin view of a driver's ride history (`GET /driver/rides/history` is the signed-in driver's own), inspection scheduling, track switch.
- Note: the current mock "Recent trips" calls `rideService.listDriverTrips(track)`, which is not filtered by driver id. The live version must query by driver.

### 5.9 Passengers (`passengers-list.tsx`)

- Columns: member (name, avatar, email, verified), area, rides, rating, trusted contacts count, joined date, membership status.
- Search: name or email. Filters: All (n), Verified, Not yet confirmed, No trusted contact.
- **Exists:** `GET /users?role=User&search=` gives name, email, city, created date, `is_identity_verified`.
- **Missing:** ride count, rating, trusted-contact count, membership status (`UNVERIFIED, CHECKING, VERIFIED, ACTION_REQUIRED, REJECTED`; the backend only has a boolean). Proposed `GET /admin/passengers` in 6.4.

### 5.10 Passenger detail (`passenger-detail.tsx`)

- Identity, ride count, rating, trusted contacts (name and relationship; phones hidden), recent rides (4), membership status, safety setup.
- Actions: Re-check membership (**toast only**), Restrict ride requests with confirm (**toast only**; in-progress rides continue).
- **Exists:** `GET /users/{id}`.
- **Missing:** passenger ride history for admin, trusted contacts, membership re-check, and a ride-request restriction that is softer than `PATCH /users/{id}/deactivate` (which blocks login entirely). The mock "Recent rides" calls `rideService.listRides()`, which returns the signed-in user's rides, not the member's.

### 5.11 Incidents (`incidents-list.tsx`)

- Columns: incident (title, reference, ride reference), category, severity, assigned to, opened, status.
- Search: title or reference. Filters: All (n), Open, Under review, High and critical, Resolved.
- Data `Incident`: `id, reference, rideId?, rideReference?, category, severity, status, title, description, openedAt, updatedAt, resolvedAt?, assignedTo?, participants[], timeline[], adminNotes[]`.
- Categories: `SAFETY_CONCERN, SOS_ACTIVATION, DRIVER_CONDUCT, PASSENGER_CONDUCT, VEHICLE_ISSUE, PAYMENT_DISPUTE, OTHER`. Severity: `LOW, MEDIUM, HIGH, CRITICAL`. Status: `OPEN, UNDER_REVIEW, RESOLVED`.
- **Exists (write side only):** `POST /rides/{id}/sos` (`SosDto { type: medical|accident|threat|other, location?, occurredAt? }` → 202) and `POST /rides/{id}/safety-reports` (`{ category, details? }` → 202). Nothing reads them back.
- **Missing:** 6.5.

### 5.12 Incident detail (`incident-detail.tsx`)

- Summary: severity, category, ride link, description, opened time, assignee.
- People involved: name and role, with Call (**toast only**) and Record (**toast only**) buttons; phones visible while open.
- Timeline of events, notes list.
- Actions: Add note (**toast only**), Start review (OPEN → UNDER_REVIEW, **toast only**), Mark resolved with confirm (**toast only**). Copy says "Reopen it from the incident list", but no reopen action exists.
- **Missing:** 6.5.

### 5.13 Quality board (`quality-board.tsx`)

- Card per flagged driver or passenger: name, avatar, role, track, average rating (with meter), low-rating count out of trips, reason, flagged time.
- Actions: Open conversation (**toast only**), View record (link), Clear flag with confirm (**toast only**; ratings stay on record).
- Data `QualityFlag`: `id, subjectId, subjectName, subjectAvatarUrl, role, track, averageRating, lowRatings, trips, reason, flaggedAt`.
- **Missing:** 6.6. Ratings are captured by `POST /rides/{id}/rating` (`{ stars, comment?, tags[] }`) but there is no aggregate or threshold.

### 5.14 Reports (`reports.tsx`)

- Period filter: last 7, 30 or 90 days (currently not sent to the service; the same data shows for every period).
- Sections, each with metrics (value, display, delta %, intent) and an optional bar series:
  - Adoption: rides requested, rides completed, active passengers, active drivers; series requested vs completed.
  - Verification: approval rate, average verification time; series days to verify.
  - Ride performance: match rate, completion, cancellations; series match rate %.
  - Safety: incidents, SOS alerts, average resolution time; series incidents opened.
  - Ratings: passenger rating, driver rating; series average rating.
  - Retention: repeat passengers %.
  - Savings exists in the fixture but is hidden.
- Action: Export, which says a CSV will be emailed (**toast only**).
- **Missing:** 6.7.

## 6. Missing endpoints, proposed

Conventions proposed for all of these: prefix `/api/v1/admin`, `Admin` or `Root` role (403 otherwise), camelCase JSON like the paid-ride schemas, list responses `{ items, nextCursor, total }`, `?cursor=&limit=` paging (default 25, max 100), errors `{ code, message }`. Every mutation writes an activity log entry. Names are suggestions; the backend developer may prefer to extend existing routes (for example `PATCH /users/{id}/deactivate` with a body) instead.

### 6.1 Overview metrics

`GET /admin/overview?period=week`

```jsonc
{
  "primary": [ { "id": "active_drivers", "label": "Active drivers", "value": 128, "deltaPercent": 6.4, "series": [96,102,108,104,116,121,128] },
               { "id": "live_rides", ... }, { "id": "pending_verification", ... }, { "id": "open_incidents", ... } ],
  "secondary": [ { "id": "completion_rate", "value": 96.4, "display": "96.4%", "deltaPercent": 1.2 },
                 { "id": "match_rate", ... }, { "id": "avg_rating", ... }, { "id": "rides_this_week", ... } ],
  "activeSos": null | SosAlert   // see 6.5
}
```

Frontend only needs the numbers; labels and display formatting can stay client-side if the backend prefers to return raw values keyed by id.

### 6.2 Rides (network view)

`GET /admin/rides?state=active|all&status=&sos=true&q=&cursor=&limit=`

- `state=active` means any status from `SEARCHING` to `IN_PROGRESS` (plus `PAUSED`). `q` searches reference, driver name, passenger name and destination name.
- Item `AdminRideSummary`:

```jsonc
{
  "id": "uuid", "reference": "KR-2291", "status": "IN_PROGRESS", "rideType": "PRIVATE",
  "createdAt": "...", "startedAt": "...", "etaSeconds": 420,
  "pickup": Place, "destination": Place,
  "driver": { "userId": "uuid", "displayName": "...", "avatarUrl": "...", "rating": 4.9, "completedRides": 312,
              "vehicle": VehicleView } | null,
  "passengers": [ { "userId": "uuid", "displayName": "...", "avatarUrl": "...", "rating": 4.8,
                    "dropoff": Place, "state": "AWAITING_PICKUP|PICKED_UP|DROPPED_OFF|NO_SHOW" } ],
  "sos": { "status": "none|sent|acknowledged|resolved", "alertId": "uuid|null" },
  "driverLocation": LiveLocation | null
}
```

- `total` plus counts for the filter chips: `"counts": { "all": 14, "sos": 1, "inProgress": 9, "searching": 3 }`.

`GET /admin/rides/{ride_id}` returns `RideProjection` plus the fields above, plus:

- `events: [{ id, type, label, detail?, at, kind: "status|safety|payment|rating" }]` (the ride's event log; the socket `seq` events would do).
- `driver.phone` and `passengers[].phone` only while an open incident references this ride.
- `sos`: full `SosAlert` (6.5) when one exists.

Alternatively, allow admins on `GET /rides/{ride_id}` and add the missing fields there.

### 6.3 Driver applications and verification

Needs a real status enum on the driver profile: `DRAFT, SUBMITTED, DOCUMENT_REVIEW, INSPECTION_REQUIRED, INSPECTION_SCHEDULED, FINAL_REVIEW, APPROVED, CHANGES_REQUIRED, REJECTED`.

| Method and path | Purpose | Body | Response |
|---|---|---|---|
| `GET /admin/driver-applications?status=&track=&q=&cursor=&limit=` | Queue | | `{ items: ApplicationSummary[], nextCursor, total, counts }` |
| `GET /admin/driver-applications/{user_id}` | Full review record | | `Application` |
| `PATCH /admin/driver-applications/{user_id}/documents/{doc_type}` | Verify or flag one document | `{ status: "VERIFIED" \| "NEEDS_ATTENTION", note? }` (note required for `NEEDS_ATTENTION`) | `ApplicationDocument` |
| `POST /admin/driver-applications/{user_id}/comments` | Internal note or applicant feedback | `{ body, visibility: "INTERNAL" \| "APPLICANT", documentType? }` | `ReviewComment` |
| `POST /admin/driver-applications/{user_id}/inspection` | Schedule inspection | `{ scheduledAt, location, note? }` | `Inspection` |
| `POST /admin/driver-applications/{user_id}/decision` | Approve, request changes or reject | `{ decision: "APPROVE" \| "REQUEST_CHANGES" \| "REJECT", reason?, changesRequested?: string[] }` | `{ status }` |

- `ApplicationSummary`: `userId, applicantName, avatarUrl, track, status, submittedAt, updatedAt, documentsReady, documentsTotal, vehicle: VehicleView, inspection: { status, scheduledAt? }`.
- `Application`: the summary plus `documents: [{ type, label, status, mimeType, sizeBytes, uploadedAt, expiresAt?, note?, url | base64 }]`, `licence { number, class, expiryDate }`, `affiliation { isKoinoniaWorker, department?, guarantor? }`, `ninVerified`, `inspection`, `comments[]`, `changesRequested[]`.
- Document types map from `DriverRegistrationDto` fields: `nin_slip` → `GOVERNMENT_ID`, `profile_photo` → `PROFILE_PHOTO`, `licence_photo` → `DRIVERS_LICENCE`, `vehicle_registration`, `insurance_certificate` → `INSURANCE`, `roadworthiness_certificate`, `vehicle_photo`, `guarantor_photo`.
- `APPROVE` should be rejected with 409 while any required document is not `VERIFIED`, matching the UI rule, and should set the linked car's `is_verified` (or the UI keeps calling `PATCH /cars/{id}` separately; decide which).
- The decision and document notes with `APPLICANT` visibility must reach the driver's own account page.

### 6.4 Driver and passenger oversight

| Method and path | Purpose | Notes |
|---|---|---|
| `GET /admin/drivers?q=&track=&availability=online&verification=&flagged=&active=&cursor=&limit=` | Driver roster | `q` matches name and plate. Item: `userId, displayName, avatarUrl, track, verificationStatus, availability (OFFLINE\|ONLINE\|ON_TRIP), accountStatus (ACTIVE\|FLAGGED\|DEACTIVATED), rating, completedRides, vehicle: VehicleView`. No document bodies. |
| `GET /admin/drivers/{user_id}` | Driver record | Above plus `email, joinedAt, ninVerified, affiliation, inspection { status: CURRENT\|DUE_SOON\|SCHEDULED\|OVERDUE\|MISSED, lastCompletedAt?, nextDueAt, scheduledAt?, location?, note? }, deactivationReason?, stats { completedRides, rating, weekRides, weekEarnings: Money }, trackSwitch?` |
| `GET /admin/drivers/{user_id}/rides?cursor=&limit=` | Driver's ride history | `RideHistoryPage`-like, with `reference` and `total: Money` |
| `POST /admin/drivers/{user_id}/flag` / `DELETE` same | Flag or unflag for quality review | `{ reason }`. Flagged drivers appear on the quality board. |
| `POST /admin/drivers/{user_id}/deactivate` | Deactivate with a reason the driver sees | `{ reason }`. Could instead be a body on the existing `PATCH /users/{id}/deactivate`. Must set availability offline and stop offers immediately. |
| `POST /admin/drivers/{user_id}/inspection` | Schedule periodic vehicle inspection | `{ scheduledAt, location, note? }`. Same shape as 6.3. |
| `GET /admin/passengers?q=&membership=&hasTrustedContact=&cursor=&limit=` | Member roster | Item: `userId, displayName, avatarUrl, email, homeArea, membershipStatus, completedRides, rating, trustedContactCount, joinedAt, restricted` |
| `GET /admin/passengers/{user_id}` | Member record | Above plus `trustedContacts: [{ id, name, relationship }]` (phones only under the incident rule) |
| `GET /admin/passengers/{user_id}/rides?cursor=&limit=` | Member's ride history | Same shape as the driver one |
| `POST /admin/passengers/{user_id}/restriction` / `DELETE` same | Restrict or lift new ride requests | `{ reason }`. `POST /rides/request` then returns 403 `{ code: "requests_restricted" }`; rides in progress continue. |
| `POST /admin/passengers/{user_id}/membership-check` | Re-check membership | Depends on how membership is verified; no backend concept exists yet. |

Rating and trip counts could alternatively be added to `UserDto` so `GET /users` serves the rosters, but filtering by availability, flag and membership still needs new query params.

### 6.5 Safety: SOS and incidents

| Method and path | Purpose | Body | Response |
|---|---|---|---|
| `GET /admin/sos?status=active` | Live SOS alerts (shell banner, dashboard) | | `SosAlert[]` |
| `POST /admin/sos/{alert_id}/acknowledge` | Safety desk acknowledges | | `SosAlert` |
| `POST /admin/sos/{alert_id}/resolve` | Close the alert | `{ note? }` | `SosAlert` |
| `GET /admin/incidents?status=&severity=&category=&q=&cursor=&limit=` | Incident list | | `{ items: IncidentSummary[], nextCursor, total, counts }` |
| `GET /admin/incidents/{id}` | Incident record | | `Incident` |
| `POST /admin/incidents` | Open one manually | `{ rideId?, category, severity, title, description, participantIds[] }` | `Incident` |
| `PATCH /admin/incidents/{id}` | Status, severity, assignee | `{ status?: OPEN\|UNDER_REVIEW\|RESOLVED, severity?, assigneeId? }` | `Incident` |
| `POST /admin/incidents/{id}/notes` | Add an admin note | `{ note }` | `{ id, author, note, at }` |

- `SosAlert`: `id, rideId, rideReference, status (sent|acknowledged|responding|resolved), type (from SosType), raisedBy: { userId, role, displayName }, raisedAt, acknowledgedAt?, resolvedAt?, location?: LatLng, notifiedContacts?`.
- `Incident`: `id, reference, rideId?, rideReference?, category, severity, status, title, description, openedAt, updatedAt, resolvedAt?, assignedTo?: { userId, displayName }, participants: [{ userId, displayName, role, phone? }], timeline: [{ id, label, detail?, at, kind }], adminNotes: [{ id, author, note, at }]`.
- An SOS (`POST /rides/{id}/sos`) should automatically open an incident with category `SOS_ACTIVATION` and severity `CRITICAL`; a safety report (`POST /rides/{id}/safety-reports`) should open one with the reported category. The free-text `SafetyReportDto.category` should become an enum matching `IncidentCategory`.
- Resolving notifies the participants ("Everyone involved has been told it is closed" in the UI copy).
- "Call" from an incident needs a decision: either a plain `tel:` link using the released phone, or a logged call action (`POST /admin/incidents/{id}/calls`). The UI copy says the call "is logged against this incident".

### 6.6 Quality

| Method and path | Purpose |
|---|---|
| `GET /admin/quality-flags?role=Driver\|User&status=open` | Flagged drivers and members: `id, subject { userId, displayName, avatarUrl, role, track? }, averageRating, lowRatings, rides, reason, source (auto\|manual), flaggedAt` |
| `POST /admin/quality-flags/{id}/clear` | Clear a flag with `{ note? }`; ratings stay |

Needs a rule for automatic flags (for example average below a threshold over the last N rides, or N ratings of 2 stars or fewer in a week). Manual flags come from 6.4. "Open conversation" has no backend (chat is off in v1), so either drop the button or decide on a channel.

### 6.7 Reports

`GET /admin/reports?period=week|month|quarter` returns `ReportSection[]`:

```jsonc
[{ "id": "adoption", "metrics": [{ "id": "rides_requested", "value": 1421, "deltaPercent": 8.2 }, ...],
   "series": [{ "label": "Mon", "value": 148, "secondary": 92 }, ...] },
 { "id": "verification", ... }, { "id": "performance", ... }, { "id": "safety", ... },
 { "id": "ratings", ... }, { "id": "retention", ... }]
```

Metric ids needed: `rides_requested, rides_completed, active_passengers, active_drivers, approval_rate, avg_verification_days, match_rate, completion_rate, cancellation_rate, incidents, sos_alerts, avg_resolution_minutes, passenger_rating, driver_rating, repeat_passenger_rate`. Deltas compare with the previous period of the same length.

`POST /admin/reports/export` with `{ period, format: "csv" }` → 202, emailed to the requesting admin. Alternatively a synchronous `GET /admin/reports/export?period=&format=csv` download; the UI copy currently promises email.

## 7. Realtime needs

The socket today serves drivers (offers, availability) and ride participants (`ride.updated`, `ride.driver.location_updated` on `ride:{id}` channels). Admin needs:

1. **Admin may subscribe to any `ride:{id}` channel.** The live ride detail page should subscribe for `ride.updated` and `ride.driver.location_updated`. Subscription authorisation must allow `Admin`/`Root` and reject everyone else who is not a participant.
2. **A network channel, e.g. `admin:rides`,** that pushes a compact `admin.ride.changed` event (the `AdminRideSummary` from 6.2, or `{ rideId, status, sos }`) whenever any ride is created, changes status, or ends. This keeps the live rides list and dashboard current without polling. Location updates should not go on this channel (too chatty); the list can show last-known position from the REST call.
3. **A safety channel, e.g. `admin:safety`,** with `sos.raised`, `sos.updated`, `incident.opened`, `incident.updated`. This drives the SOS banner on every admin page and is the most important realtime item. It should also fire a Web Push to on-duty admins (the app already has `/api/push/*` routes).
4. **Fallback.** Until the channels exist the UI can poll: live rides and active SOS every 10 to 15 seconds, everything else on focus. The socket doc's 45 s idle timeout means admin clients must send `ping` frames like the rider client.
5. Confirm that the `access_token` cookie is accepted on the socket upgrade for admin users (the spec mentions the Bearer header; the browser cannot set it on a WebSocket).

## 8. Endpoints that already exist and will be used as they are

| Endpoint | Used for |
|---|---|
| `POST /auth/login`, `/auth/refresh`, `/auth/logout` | Admin session (shared with Free Buses) |
| `GET /users/{user_id}` | Admin identity in the shell; driver and passenger records (identity part) |
| `GET /users?search=&role=&is_active=&pagination` | Fallback for rosters until 6.4 lands |
| `PATCH /users/{user_id}/deactivate`, `/activate` | Account suspension (full login block). Add an "Activate" button on the driver record. |
| `PATCH /users/{user_id}` | Correct identity fields during review |
| `GET /cars`, `GET /cars/{car_id}`, `PATCH /cars/{car_id}` (`is_verified`) | Vehicle details; marking a vehicle verified |
| `POST /cars/{car_id}/assign-user`, `DELETE` same | Linking a car to an approved driver (no admin UI yet) |
| `GET /rides/{ride_id}` | Ride detail, if admins are allowed to read it (question 4.2) |
| `GET /logs?user_id=&target_id=&activity_type=` | Audit trail on driver, passenger and incident records, once ride and safety activity types exist |

## 9. Suggested order

1. Settle section 4 (admin role on rides, envelope, pagination, enums, phone release rule).
2. Safety first: 6.5 plus the `admin:safety` socket channel, because a missed SOS is the costliest gap.
3. Verification workflow (6.3), since no driver can be approved through the app today.
4. Network ride view (6.2) and the `admin:rides` channel.
5. Rosters and oversight actions (6.4), then quality (6.6), then overview and reports (6.1, 6.7), which are aggregates over everything above.

Frontend work per step is the same pattern: replace the fixture body in `adminService`, `userService` and `verificationService` with fetches through the paid-rides API client, map enums in one adapter, move search and filters to query params, and remove the "Preview workspace" label screen by screen.
