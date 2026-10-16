# Return boarding and coordinator scanning · 16 October 2026

## Frontend findings and fixes

- The manifest's **Board** and **Board by reference** controls were disabled whenever the QR/NFC scanner was running. Manual boarding now stops the scanner before re-reading the booking and validating it. Controls remain disabled during scanner startup or an in-flight boarding request to prevent concurrent writes.
- Boarding rejected every trip except `NotStarted`. Confirmed server-issued passes can now board while their assigned trip is `NotStarted` or `InProgress`. This covers outbound pickups at intermediate stops, separate return trips and return passes on a shared round-trip record.
- The same rule keeps confirmed passengers' QR passes and upcoming-seat counts available after departure. Manifest return/outbound labels receive the route they need to identify the leg; a label or scheduled time does not authorize boarding.
- Bus/trip identity, payment clearance, maintenance and duplicate-boarding checks remain enforced. Before a trip starts, its bus must be `Boarding` or `Stationary`. During an `InProgress` trip, the operational labels `Transit` and `Arrived` do not close pickup at intermediate stops or require an admin to reopen the bus for every stop or return boarding.
- Walk-in occupancy updates also accept the assigned `InProgress` trip at subsequent stops, retaining whole-number capacity bounds and the existing count-reconciliation rules. These remain headcounts rather than ticketed reservations.
- Trip controls say **Complete round trip** and explain that completion closes both legs. Start when leaving the first pickup point, continue boarding at later stops, and keep the shared trip `InProgress` until the return journey ends.
- A server permission denial stops the scanner and explains the missing account permission. No client-side role elevation or bypass was added.

## Why completing the outbound trip closes the return

The current API exposes one trip `status`, one actual departure and one actual arrival, plus an optional scheduled `return_time`. It has no separate outbound-completed/return-boarding state. `PATCH /trips/{trip_id}/complete` completes that shared trip. A scheduled return time does not prove that a completed trip is only halfway finished.

Consequently, an already `Completed` or `Cancelled` trip stays closed. Supporting **Complete outbound → Board return → Complete return** needs a backend lifecycle change, either linked trips with independent statuses and assignments or explicit per-leg state. Preserve two independently boardable booking IDs and signed passes, retain the correct bus assignment, and reconcile occupancy for the return. The frontend does not reset a completed trip or infer a phase from the clock.

The current API also exposes no authoritative current-stop or active-leg field. If boarding must be restricted to a particular stop or leg, that needs explicit backend state and enforcement. The frontend reads the actual booking, bus and trip before writing, and the API remains responsible for authorization and atomic boarding validation. This change does not open new online reservations after departure.

## Why Route Coordinators cannot scan

Checked the published [OpenAPI document](https://api.freebus.cloud/api-docs/openapi.json) on 16 October 2026. It still documents these permissions:

| Operation used by boarding | Documented access |
| --- | --- |
| `GET /bookings?bus_id=…` | Admin/Root |
| `POST /bookings/verify` | Admin/Root |
| `GET /bookings/{booking_id}` | Booking owner or Admin/Root |
| `PATCH /bookings/{booking_id}/board` | Admin/Root |

The frontend already admits `RouteCoordinator` to Boarding and shows its scan controls. The backend must grant appropriately scoped `RouteCoordinator` access to all four operations and enforce assigned bus/trip boundaries. Granting only the final boarding endpoint will still leave verification and lookup blocked. Bus/trip/route reads must also be permitted for the coordinator's assigned work. Trip action documentation says `Coordinator` while the role enum says `RouteCoordinator`; verify the actual role checks use the correct value.

This confirms the published contract mismatch, not a live authenticated 403 for a particular coordinator account. No real booking or fleet writes were performed.

## Validation

27 focused tests passed, including intermediate-stop boarding on every trip type, separate outbound/return bookings, operational bus states during an active trip, walk-in capacity, mismatched assignments, payment clearance, maintenance, duplicate boarding and terminal trip states. TypeScript and ESLint checks passed for the affected code. Camera/NFC hardware and authenticated production boarding were not exercised.
