# Boarding and scheduled-trip requirements

Backend handoff · Updated 31 October 2026

Scope: Freebus boarding and existing scheduled rides. Vehicle hire/rental and company registration are deferred and must remain off; they are not requirements for this release.

## Delivery status and existing integration

This repository is the frontend. Endpoint availability below is based on the checked-in contracts and existing integrations, not a claim that every production role has been granted access. Paths are relative to the existing `/api/v1` API base unless noted. Proposed endpoints are explicitly marked; none are called by the frontend yet.

| Concern | Frontend available now | Backend work |
| --- | --- | --- |
| One-use boarding passes | Rejects Boarded/Cancelled/Revoked bookings; refreshes booking before manual boarding; scans verify then fetch the booking; local duplicate guard covers scan and manual boarding; hides QR when pass is no longer active | Confirm atomic one-use enforcement across devices and audit history |
| Coordinator name search | Existing Search manifest searches passenger name, reference and seat; manual Board uses existing endpoint | Ensure scoped coordinator permissions and return names efficiently |
| Advance scheduling | Existing passenger scheduling, fare quote, driver acceptance, cancellation reasons and admin assignment | Existing schedule API must remain available |
| Admin scheduled trips | All-status paginated list, date/status filters, today/driver-confirmed shortcuts, passenger and driver contact details, current vehicle, profile and linked-ride links | Return booking-specific vehicle and immutable assignment history |
| Cancellation/no-show penalties | Existing cancellation/release reason submission; driver profile link exposes existing admin review controls | Durable incident ledger, no-show determination, policy decisions, appeals and enforcement |

### Existing endpoints reused

- Free buses: `GET bookings?bus_id=…`, `GET bookings/{id}`, `POST bookings/verify` with `{qr_payload}`, `PATCH bookings/{id}/board`, `GET bookings/{id}/qrcode`, `GET buses/{id}`, `GET trips/{id}` and `GET users/{id}` for manifest names.
- Scheduled rides: `GET/POST rides/scheduled`, `GET/PATCH rides/scheduled/{id}`, `POST rides/scheduled/{id}/cancel`.
- Driver schedules: `GET driver/scheduled-requests`, `POST driver/scheduled-requests/{id}/accept` with `{version}`, `POST driver/scheduled-requests/{id}/cancel` with `{reason}`.
- Oversight: `GET admin/scheduled-rides`, `POST admin/scheduled-rides/{id}/assign` with `{driverId,version}`, `GET admin/drivers/{id}`, `GET admin/passengers/{id}`. Existing admin driver flag/deactivation actions remain manual actions, not an automated penalty policy.
- Schedule list filters: `status`, `from`, `to`, `cursor`, `limit`; `mine` additionally supported for drivers. Existing statuses: OPEN, RESERVED, ACTIVATED, COMPLETED, CANCELLED, EXPIRED. Do not infer missed pickups from EXPIRED alone.

## 1. One boarding per pass, with separate round-trip legs

A copied QR or borrowed phone can still be presented before its first use. One-use protection prevents reuse, not impersonation on the first use. Coordinators need the passenger name and an agreed identity check. Do not treat phone ownership or possession of the QR as proof of identity.

Required server behavior:

1. Signed tokens identify a booking and leg; validate signature, expiry, revocation, account/payment eligibility, bus, trip and coordinator access. Never trust status embedded in the QR.
2. Perform Confirmed → Boarded as one conditional transaction. Record `boardedAt`, `boardedBy`, bus, trip and leg. Occupancy changes exactly once in the same transaction. Two devices cannot both succeed.
3. A later use returns HTTP 409 with stable code `PASS_ALREADY_USED`, human-readable message and authorized usage timestamp. `POST bookings/verify` returns `valid:false` for consumed passes. Verification alone does not consume a pass; boarding does.
4. Apply the same transaction to scanned, NFC and manual boarding. A lost response must be reconciled by reading the booking, never by blindly incrementing occupancy again. Support an idempotency key for mutation retries and clearly distinguish a replay of the original result from a newly boarded passenger.
5. Do not issue a usable QR for boarded, revoked, cancelled or closed-trip passes. Existing downloaded images must also fail server validation.
6. Outbound and return have separate booking/pass IDs. Using outbound does not consume return; neither leg can be used twice. Preserve existing return eligibility while the round trip is InProgress. Completed remains terminal. Support intermediate-stop boarding without toggling the bus offline or resetting previous pass usage.
7. Enforce coordinator scope on the server: only assigned buses/trips, minimal passenger identity fields. Prefer name/identity summary directly on the manifest rather than granting coordinators unrestricted account-directory access. Return cursor/search support if manifests become paginated; current frontend name search covers the loaded manifest.
8. Refresh manifest/pass status after boarding, plus publish a booking update event. Store an audit trail for attempted reuse without exposing QR secrets in logs.

Acceptance tests: race two devices (one success, one already-used result, one occupancy increment); scan then manual attempt; manual then scan; refresh/logout/device change; replay a screenshot after use; network loss after commit; wrong bus; cancelled/expired pass; unauthorized coordinator; independent outbound/return passes; intermediate stops. Identity sharing before first use remains an operational identity-check concern.

## 2. Admin visibility for accepted scheduled trips

`GET admin/scheduled-rides` must include all passengers' schedules, including RESERVED/ACTIVATED, not only the current admin's records. Driver acceptance and admin assignment must commit the assignment and new version atomically before the list reflects success. Existing frontend polls visible schedules every ten seconds and refreshes on focus/reconnect.

Extend schedule responses with optional nested participant summaries and a booking-specific vehicle snapshot:

```json
{"passenger":{"id":"uuid","name":"Passenger name","phone":"+234…"},"driver":{"id":"uuid","name":"Driver name","phone":"+234…"},"vehicle":{"id":"uuid","plateNumber":"ABC123","make":"Toyota","model":"…"},"acceptedAt":"2026-12-01T07:00:00Z","assignmentHistory":[]}
```

The frontend currently resolves contacts through admin detail endpoints and labels the driver's current vehicle explicitly. That vehicle is not proof of the vehicle reserved for a historical/future booking. Return the assigned snapshot on the booking to close this gap, and document whether driver IDs are account IDs (as currently assumed).

Keep assignment history when a driver releases, an admin reassigns or a passenger reschedules: actor, old/new driver/vehicle, reason, timestamp and version. Publish an admin-authorized schedule event after each change. Preserve pagination/filter behavior and access controls. Test accept → admin list without reload, reassignment, release, missing profile data and multiple pages of accepted trips.

## 3. Cancellations, missed pickups and penalties

Cancellation/release reasons already reach the existing APIs. Do not use the latest `cancellationReason` field as a disciplinary ledger: a released reservation may reopen and clear its driver ID. Preserve the original assigned driver and events independently.

### Required records and decisions

- Immutable event: incident ID, schedule/ride ID, driver, passenger, event type (driver cancellation / late arrival / missed pickup), scheduled time, assignment/acceptance time, actual event time, actor, reason, available evidence and policy version.
- Distinguish passenger cancellation, admin change, approved emergency, operational failure and driver-caused cancellation. Missing GPS/WebSocket updates alone do not prove a missed pickup.
- A server worker may flag suspected missed pickups after a configurable grace period; confirmed arrival/trip state, passenger report and human review determine the outcome. Deduplicate processing by booking + event type. Handle worker retry/outage.
- Policy settings need business approval: grace period, cancellation cutoff, repeat-offence window, excused reasons, thresholds, warning/temporary scheduling restriction/suspension rules, appeal period and who can review. No monetary amount or automatic fine is authorized by this document.
- Review lifecycle: REPORTED → UNDER_REVIEW → EXCUSED or CONFIRMED → APPEALED/RESOLVED where applicable. Record reviewer, reason, evidence and audit history. Notify driver and affected passenger as appropriate. Allow correction of an erroneous penalty.
- Enforce active restrictions on all server acceptance/assignment/online paths as defined by policy. A disabled browser button is insufficient. Fines, if later approved, require a separate ledger and lawful payment/consent handling; never silently deduct arbitrary amounts.

Proposed endpoints: `GET admin/driver-incidents` (date, driver, event/status filters), `GET admin/driver-incidents/{id}`, `POST admin/driver-incidents/{id}/review` with expected version/outcome/reason, `GET driver/penalties`, `POST driver/penalties/{id}/appeal`, and admin policy read/update endpoints with audited revisions. Passenger report endpoints must enforce booking ownership and deduplication. Existing generic flag/deactivate actions can support manual intervention; they are not a substitute for this history or automatic penalties.

Acceptance: reason preserved after driver release/reassignment; justified cancellation excused; repeated confirmed offences counted within policy window; offline location alone creates no automatic guilt; worker retries create one incident; unauthorized review rejected; appeal/correction updates restriction and audit trail; passenger cancellation never penalizes driver automatically.

## Integration and delivery checklist

1. Prioritize atomic boarding and coordinator permissions, then scheduled assignment snapshots/history.
2. Publish incident and scheduled-assignment OpenAPI schemas, example responses, role matrix and error codes before frontend integration.
3. Use integer money, UTC instants plus IANA timezone, cursor pagination, explicit version conflicts (409), stable validation errors and idempotency for consequential creation/payment actions. Never return a successful-looking placeholder.
4. Provide staging accounts for passenger, assigned coordinator, driver, Admin and Root, with seeded passes and scheduled rides.
5. Provide event payloads and authorization, migration/backfill plans for existing round-trip passes and accepted schedules, and automated concurrency/permission tests.
6. Confirm the penalty policy with the product owner before implementing enforcement.

## Scheduled participant contact access (1 November 2026)

Passenger and assigned-driver schedule cards now resolve the other participant through authenticated `GET users/{id}`, using the booking's passengerId/driverId. The frontend retains and displays only name and phone. Confirm that assigned drivers and booking-owning passengers can access those contacts; an admin's successful request does not establish participant permissions. Return 403 for unrelated accounts. Prefer a booking-scoped contact response exposing only name/phone rather than the full user response (which currently includes identity documents and other private fields). Test both roles after acceptance, reassignment, release and logout. No administrative credentials or admin-only endpoints are used in participant views.
