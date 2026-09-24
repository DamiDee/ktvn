# Free Buses

This page describes the **original demo mode** (`NEXT_PUBLIC_FREE_BUSES_MODE=demo`). Live mode is now the default; see [Free Buses API integration](free-buses-api.md) for setup, supported real operations, verification and backend gaps.

Member page: `/passenger/free-buses`. Admin page: `/admin/free-buses`.

## Booking rules

- A service event records Koinonia Sunday Service or T.G.A, its date, venue and the return boarding point at that venue.
- Each allocation belongs to an event, community location and direction. Outbound pickup and return drop-off locations are independent.
- Admins publish allocations with 0–30 buses, a bus model, 1–60 passenger seats per bus and a boarding date/time. The default is an 18-seat Toyota Hiace. All scheduling times use Abuja time (WAT).
- Members receive one seat per service event per direction. A second reservation at another pickup point for the same leg is rejected. A return seat must be booked separately.
- Bookings fill buses in order. Cancelled seats can be reused before departure. The final seat marks its bus departed and produces exactly one broadcast containing the departed and remaining counts.
- A route with no remaining buses is greyed out and cannot accept bookings. Admins may add buses to reopen it without changing existing reservations.
- Drivers have no navigation entry, cannot open the member experience and cannot reserve seats through the service's role checks.
- Member boarding passes show the exact bus, seat, reference, meeting point and journey endpoints. Admins see a manifest for each bus.

## Demo persistence and updates

Demo mode has mock authentication. It uses an IndexedDB repository, `src/services/free-bus-service.ts`, so schedules, bookings and notices survive a reload in the same browser. Database read/write transactions serialize booking attempts across tabs; a booking and its final-seat departure notification commit together. BroadcastChannel updates other tabs, with periodic query refresh as a fallback. Live mode does not read or import these records.

The notification bell and drawer include bus broadcasts for members and admins. These are in-app notices in the current browser, not push/SMS messages or broadcasts to other devices. The supplied venues and passenger manifests are demo fixtures. The admin manifest includes an explicitly labelled demo action to fill the next bus and exercise departure notifications.

For a deployed multi-user service, replace the browser repository with authenticated API endpoints and a shared database. Preserve the transaction: verify membership and role from the server session, enforce one booking per event/direction, lock the available bus, allocate a unique seat, and commit the departure event once. Deliver that event through the server notification system to members and admins. Client role checks in this demo are not a server security boundary.

Automatic departure on the final booked seat follows the requested simulation. A real boarding operation may need steward-confirmed boarding/departure; that policy can replace the transition without changing the allocation model.

## Verification

`npm run test:free-buses` runs the domain regression tests (Node 22.6+ with TypeScript stripping). Coverage includes first-come allocation, final-seat exhaustion, duplicate prevention, independent directions, cancellation, role checks, invalid schedules, adding buses and demo dispatch.

The core transitions live in `src/lib/free-buses.ts` and are independent of React and storage. Both member actions and demo bookings call the same transitions.
