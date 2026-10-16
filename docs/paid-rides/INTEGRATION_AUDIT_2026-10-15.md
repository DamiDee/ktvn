# Paid Rides integration and reliability audit

Date: 15 October 2026. Repository baseline: `23682f7`.

## Verdict and scope

**The passenger/driver core is implemented against the REST contract, but this is not yet a production-readiness sign-off. Paid-admin operations are a demo, and important transport, security and operational guarantees remain unverified.**

Reviewed the three supplied Downloads files, paid-rides REST/socket adapters, domain reducers, session orchestration, location reporting, authentication refresh, feature flags, admin service and relevant tests. The supplied OpenAPI and WebSocket files match the repository copies byte-for-byte. No Rust/Axum backend source, database migrations, deployment configuration, production logs or authenticated staging sessions were available in this workspace. No real rides, offers, payments or emergencies were created during the audit.

Status terms: **implemented** means source-level wiring exists; **verified locally** means automated checks passed; neither means the deployed API has been proven end-to-end.

## 1. Contract conflicts to resolve

Use OpenAPI for REST payloads and the WebSocket specification for socket frames until the backend publishes one reconciled version. Do not send both incompatible request formats as a workaround.

| Area | Supplied documents disagree | Current integration / required decision |
| --- | --- | --- |
| Viewer | Markdown: `{user, activeRide}`. OpenAPI: `{displayName, roles, vehicle}`. | Adapter uses OpenAPI. A malformed viewer now fails instead of opening a session. Supply real passenger and driver examples. |
| Estimate/request | Markdown omits estimate identity and uses `paymentMethod`, `passengersCount`; OpenAPI requires `estimateId`, `optionId`, `paymentMethodId`. | Keep quote-bound OpenAPI requests. Confirm server freezes price, places and product in the estimate. |
| SOS | Markdown uses `triggerLocation`; OpenAPI uses `type`, `location`, `occurredAt`. | Keep OpenAPI shape; keep SOS disabled until dispatch, acknowledgement and on-call ownership are proven. HTTP 202 alone is not human acknowledgement. |
| Route geometry | Paid `route` fields reference the Free Bus `Route` schema. | Rename the paid geometry schema to `RideRouteGeometry`. Confirm real points/distance/duration/source payload. Approximate display fallback is not proof of road pricing. |
| WebSocket identity | App used `/ws/<driverId>`; supplied protocol says authenticated `/rides/ws` or `/api/v1/rides/ws`. | Fixed to use exactly the configured URL for every role. Driver identity must come from authenticated claims. Confirm the deployed mount and cookie path. |
| Sequence | Requirements promise monotonic ordering; examples repeat `seq: 1`. | Sequence remains untrusted; dedupe by event ID, snapshots by ride version, periodic REST reconciliation added. Define sequence scope and reset semantics before enabling sequence gating. |
| Roles | Markdown uses `Regular`; OpenAPI uses `User`, `Driver`, `Admin`, `Root`, `RouteCoordinator`; Viewer roles are unenumerated strings. | Confirm exact viewer role values and whether drivers/admins may book as passengers. Backend remains the authority. |
| Errors | Narrative uses 409/410; OpenAPI often uses ambiguous 400. | Adapter has endpoint-specific fallbacks, but cannot reliably distinguish every failure. Publish machine-readable error codes and response fixtures. |
| GPS freshness | Requirements describe a 20s stationary interval; dispatch TTL is 15s; newer narrative asks for 2–4s updates. | App currently uses 4s movement updates / 10s stationary sampling. Agree on measured TTL/headroom, fresh-fix age and offline behavior. |
| History | Response includes `nextCursor`, but query parameters are absent. | Confirm `cursor`, stable ordering, page size and termination. |
| Availability | `EstimateOption.available=false` is described as no nearby driver but says the user may still request. UI disables unavailable products. | Decide whether this is a hard eligibility flag or a soft supply hint; use separate fields if both are needed. |
| Pickup ETA | Requirements demand route-aware ETA; OpenAPI describes `pickupEtaSeconds` as route-free. | Label estimates honestly and use routing-derived approach/progress once assigned. |
| Lifecycle | Markdown status table omits re-dispatch transitions described by its own cancel endpoint; requirements have more states. | Publish one transition table and enforce it transactionally on the server. |

## 2. Fixes made in this audit

1. **Socket endpoint:** removed driver-ID URL suffix and client identity dependence. Updated configuration comments.
2. **Socket lifecycle:** stale callbacks cannot stop a newer socket's heartbeat or deliver old events; explicit offline/resume replaces stale sockets; missing pong causes recovery; send failure allows HTTP GPS fallback. Ride subscriptions are reference-counted so closing chat cannot unsubscribe the main trip screen.
3. **GPS integrity:** removed fabricated fresh timestamps on old positions. Reject stale/low-quality fixes; stationary reporting requests actual fresh GPS, without overlapping acquisition attempts. Real observation time is retained.
4. **GPS continuity:** reporting moved from the Drive screen into the driver session so Account/Trips navigation does not stop it.
5. **Session refresh:** refresh requests now include JSON headers even when the transport wrapper does not add them. `AbortSignal.timeout` errors are recognized as timeouts.
6. **Authorization gating:** driver/passenger sessions and child screens wait for a valid viewer response. Non-auth viewer failures no longer silently mount interactive ride flows. This is UX defense, not a substitute for server authorization.
7. **API boundary:** invalid coordinate ranges, non-integer/negative monetary values, malformed essential ride/estimate data and missing location timestamps fail safely. Missing fare no longer becomes a misleading zero-price quote. Unsafe non-telephone call links are discarded; malformed socket ride payloads are ignored rather than crashing listeners.
8. **Reconciliation:** live rides are refreshed every 30s even with an open socket because replay/sequence guarantees are unknown; disconnected live rides refresh every 8s. Online drivers also reconcile availability.
9. **Driver cancellation:** a successful cancellation returning passenger `SEARCHING` clears the cancelling driver's ride and refreshes their current server state, rather than treating that search as their own active trip.
10. **Honest network copy:** an unanswered mutation no longer claims “Nothing was sent.” A server may have committed before the response was lost.

## 3. Integration inventory

| Capability | App status | What remains |
| --- | --- | --- |
| Viewer, estimates, request, current/detail ride | REST adapters implemented | Authenticated staging fixtures, expiry/conflict tests, geometry correction |
| Availability, offers, arrived/start/complete/cancel | REST adapters implemented; socket path corrected | Two-device staging ride, eligibility, offer expiry, concurrency, PIN-policy confirmation |
| Live position | Socket + REST fallback implemented | Freshness acceptance tests, stationary-driver TTL, locked-phone/background behavior |
| Reconnect/reload | REST snapshot recovery + ordering + polling | Restart/multi-node tests; offer recovery endpoint/replay is not documented |
| History and rating | Implemented | Confirm cursor semantics, completed-ride recovery window, repeated-rating behavior |
| Waiting charges | Mapped and displayed in the paid UI | Validate free-window, rounding, final settlement and quote consistency on server |
| Fleet `/cars` and assignments | Backend paths exist | Paid-admin UI/service wiring; use OpenAPI filters (`search`, `car_type`, `car_tier`, `car_size`, `is_verified`), not the Markdown filter names |
| Paid-admin live rides, incidents, metrics | **Mock service** (`src/services/admin-service.ts`); preview banner already present | Admin-scoped ride list/detail/events, incident/SOS acknowledgement, operational metrics and live adapter |
| Driver application/verification/inspections | Legacy verification service uses mocks; DTO includes driver profile | Explicit submission/upload/review/inspection APIs, secure document storage and eligibility enforcement; `/cars` alone does not complete this workflow |
| Chat | Disabled in API mode by default; no documented endpoints | Message APIs and chat event mapping. Setting `NEXT_PUBLIC_PAID_RIDES_CHAT=on` alone is insufficient: `mapPayload` currently drops chat events. |
| Sharing | Endpoint wired | Confirm destination URL, token expiry/revocation, public tracking receiver, privacy boundaries |
| SOS | Endpoint adapter exists, gated | Staffed desk, alert delivery/retries, audit trail, acknowledgement event and escalation runbook |
| Shared rides / payment collection | Partial domain/UI vocabulary, no complete documented workflow | Seat allocation/route optimization/payment provider/webhook/ledger contracts; do not advertise these as delivered |

## 4. Release-blocking backend checks

These are requirements to verify, not claims of proven vulnerabilities in an unseen backend.

- **Authorization:** reject unrelated riders/drivers/admin roles on every ride, message, location and mutation endpoint. Validate ride subscription ownership on subscribe and when assignment changes. Validate allowed WebSocket Origin: CORS does not itself authorize a socket. Revoke live access when suspended or signed out.
- **Atomic dispatch:** locking only `rides.status = SEARCHING AND driver_id IS NULL` prevents two drivers winning one ride, but does not by itself prevent one driver winning two different rides concurrently. Lock/check driver eligibility and availability in the same transaction; enforce one active assignment per driver and one live request per passenger with database constraints appropriate to permitted states.
- **Offer validity:** authenticate offer ownership, check server expiry and dispatch generation, and exclude previously declined drivers. A client countdown is informational only.
- **Idempotency:** persist keys scoped to identity + operation with request hashes and stored results. Same key/different payload must conflict. Commit idempotency result and state/financial effects transactionally; document retention and treatment of validation failures. Header presence is not backend enforcement.
- **Durable publication:** commit state/version and an outbox event atomically. Publish asynchronously with retry/deduplication so a DB commit cannot disappear from realtime after a process crash.
- **Restart / scale:** RAM mailboxes and `active_ride_id` are process-local. Define reconnection rehydration and cross-node event routing. Redis pub/sub alone is not durable replay; use a durable queue/stream/outbox as appropriate. Fence old connections so a closing socket cannot unregister a newer connection for the same driver.
- **Location:** separate device observation time, server receive time and presence lease. Reject stale/out-of-order/future/invalid fixes; don't use inaccurate GPS for arrival decisions. Verify active-trip broadcast is not accidentally skipped because assigned drivers are removed from the online matching pool.
- **Authentication:** verify HTTP-only cookies, Secure/SameSite/domain/path, origin allowlists and CSRF protection for mutations. Test refresh rotation, cookie-only WebSocket upgrade, expiry during a socket session and session revocation. Browser native WebSocket cannot supply a custom Authorization header via its constructor; no bearer tokens should be placed in URLs.
- **Sensitive data:** OpenAPI contains a `User` schema with `password_hash`. That does not prove it is exposed, but verify every handler serializes safe DTOs, never that persistence model. Restrict document/identity/location access and retention; remove raw phone/id fields from unaccepted offer payloads.

## 5. Remaining app reliability work

- **Account isolation:** paid stores are module singletons, refresh/mutation completions have no account-generation fence, and viewer query keys are generic. Add an explicit authenticated account lifecycle: cancel in-flight work, close sockets, reset ride/chat/draft state, clear account-specific caches on logout/account change, and discard results from old generations. Login currently clears query cache, but that does not reset Zustand stores. Test account A → logout → account B without a full browser restart.
- **Unified refresh coordinator:** Free Buses and Paid Rides instantiate separate session transports despite sharing cookies. Coalesce refresh/logout across modules and, where refresh-token rotation requires it, tabs. Otherwise concurrent rotations can invalidate each other. Current fix covers the missing refresh content type, not this broader lifecycle change.
- **Request idempotency lifecycle:** passenger keys are reused after ambiguous failures, which is good, but option/payment/estimate changes must create a new attempt key while retries of the same exact payload retain it. Start-with-wrong-PIN and corrected-PIN attempts need an agreed failure-cache policy. Test changing the quote after failure and retry after page reload.
- **Stale snapshot races:** explicitly fence availability refreshes against newer mutations/events; polling must not temporarily restore stale ONLINE after suspension or stale OFFLINE after a successful online response. Ride versions already protect ride snapshots, not availability.
- **Offer recovery:** availability/current-ride polling cannot retrieve missed offers. Add a current-valid-offer endpoint or durable replay/subscribe acknowledgement; expired offers should never be resurrected after resume.
- **Error/integration coverage:** extend fake transport tests to every REST method/body, malformed response, cookie refresh and timeout; add real-browser auth/permissions/navigation tests. Unit tests do not prove cross-origin cookies or deployed sockets.
- **Socket opening/auth timeout:** heartbeat recovery applies after open. Add bounded connecting/auth-failure handling and coordinate session refresh before reconnect after authentication expiry; avoid perpetual reconnect attempts with an expired cookie.
- **Approximate route fallback:** currently remains supported and marked approximate; real fares must always be server-priced. Decide whether to block estimates when routing cannot provide an acceptable route.

## 6. Recommended implementation order

1. **Freeze the contract:** resolve section 1, publish real redacted passenger/driver/offer/event samples and correct OpenAPI route schemas/errors. Treat schema changes as versioned changes with CI compatibility checks.
2. **Prove the core loop on staging:** one passenger and two verified drivers, assigned cars, valid cookies, configured HTTPS/WSS. Complete estimate → request → competing offers → accept → GPS → arrived → start → complete → rate/history; test cancellation and retry.
3. **Close release blockers:** server authorization/concurrency/idempotency/outbox and app account isolation/refresh coordination. Do this before enabling broad access.
4. **Finish operations:** fleet CRUD/assignments, driver review/inspection integration, then paid-admin live rides and safety console. Keep preview labels until adapters genuinely use production APIs.
5. **Controlled pilot:** measure offers received/accepted/expired, dispatch latency, location age, reconciliation failures, reconnect rate, duplicate mutation conflicts, settlement failures and SOS acknowledgement time. Add alarms and rollback flags.

## 7. Acceptance scenarios

| Scenario | Required outcome |
| --- | --- |
| Two drivers accept one offer/ride concurrently | Exactly one assignment; loser gets stable conflict; no double charge |
| One driver accepts two rides concurrently | At most one live assignment |
| Request response lost after server commit | Same key returns same ride; current-ride recovery finds it |
| Passenger cancels while driver accepts | One valid serialized outcome; no ghost assignment or orphan offer |
| Driver cancels before pickup | Passenger re-dispatched; old driver no longer tracks/controls that ride |
| Driver opens Account/Trips while online | Fresh reporting continues inside paid driver session |
| GPS stops but socket remains open | Position stays last-known; no invented timestamp; matching eligibility expires safely |
| Socket silently blackholes | Pong watchdog reconnects, subscriptions restored, state re-read |
| Server restarts / connection lands on another node | Ride/availability rehydrated; offers and updates route correctly |
| Unauthorized ride subscription or stale reassigned driver | Rejected; no position or passenger data disclosed |
| Token expires / two modules refresh / logout during refresh | No retry loop, no stale account restoration, no credential leakage |
| Account A signs out and account B signs in | No A ride/chat/location/identity shown or mutated under B |
| Emergency accepted but desk unavailable | Honest sent-vs-acknowledged UI and operational escalation, not false reassurance |
| Locked phone / background tab | Server detects stale presence; foreground recovery re-reads state |

## Browser constraint

Do not promise continuous driver tracking from a backgrounded web page. Browsers throttle background timers; reliable background-driving requirements should be evaluated for a native driver application, while the web app remains suitable for passengers, administration and foreground driving. See [MDN Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) and [WebSocket constructor](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket).

## Validation

New regression tests cover common socket URL, subscription ownership within the client, stale socket callbacks, pong timeout, malformed API data, unsafe call links and refresh JSON headers. Validation completed: **101 tests passed**, ESLint passed, TypeScript passed, and the production webpack build generated all 76 pages successfully. A successful build/test run is local evidence only; the staging scenarios above remain a release gate.
