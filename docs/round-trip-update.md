# Scheduled bookings and round trips · October 2026

Built on the user's clean local commit `361ac12`, using the attached October 2 OpenAPI snapshot (now saved as `public/openapi.json`).

## Member flow

- Pickup and drop-off are mandatory, explicit selections. Both come from the route endpoints and published stops; drop-off must follow pickup in the route's published order.
- Booking sends `pickup_point`, `dropoff_point`, `num_of_kids`, `return_trip`, and the selected route, trip and assigned bus IDs.
- A return checkbox appears only when a valid return time is scheduled after outbound arrival. Old browser-only return preferences are not interpreted as reservations.
- One request creates a booking. There is no automatic second POST, mutation retry or client-created QR code. The backend is responsible for issuing both actual bookings atomically.
- The pass list renders each booking returned by `GET /bookings/me`. Each detail page fetches its own `/bookings/{id}/qrcode`. Pickup/drop-off and children use the saved booking values.
- Return direction is explicit for a Dropoff trip. For a RoundTrip (or outbound trip with a return time), reversed saved stops identify the homeward leg; its departure uses `return_time`. Unknown legs are not assigned a fabricated departure.
- Only buses assigned to the chosen trip are considered. No assumed 50-seat availability or unrelated fleet fallback remains.

## Future trip requests

- Travel-day choices are derived exclusively from published, future, free NotStarted departures.
- A request re-reads the selected trip and route before posting. Cancelled, changed, past or removed schedules cannot be requested through this UI.
- The existing endpoint still accepts only route/date/count, not trip ID. Requests therefore count interest for a route/day, not a specific departure or reserved seat. The backend should also enforce schedule eligibility.
- Browser duplicate guards are scoped per member. The API does not identify individual request authors, so cross-device deduplication is not possible from this contract.

## Required walkthrough

- Opens automatically before member pages can be used; all five steps and the final acknowledgement are required.
- Progress and completion timestamp are saved under `kr-member-guide:v2:{userId}`. Legacy v1 “seen” dismissals do not count as completion.
- Completion is per member **in this browser**, as requested. Clearing storage, another browser/device or a newer guide version can require repeating it.
- Blocked storage permits completion in the mounted session but cannot persist it; a visible notice explains this.
- No central admin completion report or invented API write is included.

## Contract limits requiring backend confirmation

The user confirmed that there will be different booking passes, but no successful response is available yet. The supplied contract still declares one Booking in the create response and no round-trip pair ID or leg field. Integration uses the documented single response and reads all actual bookings afterwards. It must be checked against a real successful booking once the backend issues both legs. If it changes to a pair/array envelope, update the response adapter to that documented shape.

Do not duplicate the outbound booking or QR in the browser to simulate a return pass. One-pass responses remain one pass with guidance to refresh/contact the team.

`CreateTripDto` supports `return_time`; `UpdateTripDto` does not. Admins can set it when scheduling a new round trip. Editing an existing return time is intentionally read-only until PATCH supports it.

Backend acceptance checks: two distinct booking IDs/references and signed QRs; correct per-leg points and schedules; same-bus allocation if promised; child capacity on both legs; independent boarding and cancellation behavior, including return boarding after the outbound trip has started/completed.

## Verification

- 60 automated tests cover the existing flows plus required/ordered stops, API-required fields, party capacity, assigned-bus eligibility, return timing, separate leg labels, schedule eligibility and versioned member-specific guide completion.
- Isolated Chrome checks at a 390px mobile viewport verified required onboarding/resume/reload/account isolation, mandatory stop selection, one round-trip POST, two distinct pass detail/QR requests, reverse homeward stops, WAT time in a US-timezone browser, scheduled dates only, stale cancellation rejection and in-place admin round-trip scheduling.
- A simulated backend that issues only one pass was also tested: the app does not invent a second pass or submit a second booking automatically.
- Browser checks used intercepted synthetic responses only. They do not establish live backend paired issuance, child-seat accounting or return boarding permissions.
