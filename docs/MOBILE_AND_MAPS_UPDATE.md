# Paid rides: Android, maps and account changes

## Delivered in source

- `/admin/ride-history`: server-filtered Completed and Cancelled lists, search,
  cursor pagination and links to the existing admin ride record. Existing live
  oversight stays separate. Past records no longer display an arriving ETA.
- Paid-rides Account: edit first/last name, phone, address, city and country.
  Uses authenticated `PATCH /users/{signed-in-user-id}`, explicit allowed fields,
  the existing cookie refresh/session boundary, validation and a saving state.
- Completed passenger rides and history details: driver's bank account display
  and copy action, when explicitly included by the backend in that ride.
  Missing details have an honest unavailable state. Payment stays pending until
  confirmed by the backend; copying/transferring is never treated as payment.
- Both passenger and driver maps resolve missing/approximate geometry using
  OSRM, including driver-to-pickup approaches. Requests run independently of
  ride controls. Geometries are cached in the shared query cache for 10 minutes;
  approach coordinates use ~100 m query buckets to avoid routing every GPS fix.
  An unavailable router leaves live locations visible and shows an explanation,
  instead of drawing an invented road. Supplied GeoJSON road shapes are accepted.
- Shared route loading animation and Account loading/error states.
- Android 0.1.3+4: branded loading cover disappears at first visible page content
  instead of waiting for map images. Public OpenStreetMap tiles actually viewed
  by the user have a 64 MiB device disk cache using OkHttp's normal HTTP expiry
  and validators. No account, API, socket or cookie data goes into this tile cache.

Web changes must be deployed to `https://app.freebus.cloud` to appear in the APK.
The Android caching/loading changes need installation of the updated APK.

## Backend work still required

### Driver payment details

The supplied paid-rides OpenAPI documents `bank_name` and `account_number` on
registration and the internal User model, but not on DriverView/RideProjection.
Do not query a public user record to bypass this missing projection.

Extend the authenticated passenger ride projection returned by
`GET /rides/{id}` and the COMPLETED socket event with:

```json
{
  "status": "COMPLETED",
  "driver": {
    "bankAccount": {
      "bankName": "Driver's actual bank",
      "accountNumber": "0123456789",
      "accountName": "Verified recipient name"
    }
  }
}
```

This example illustrates the contract only; it is not a real account.
Authorize access to that ride's passenger only, release only after completion,
keep account numbers as strings, and snapshot the details for the ride so later
profile changes do not rewrite old payment instructions. `accountName` is
optional. The client also understands the existing snake_case bank fields if
included directly in the authorized driver projection.

### Editing verified driver records

Personal updates use the existing supported endpoint. The supplied contract has
no driver-owned update route for licence, guarantor, worker affiliation or driver
document uploads, and UpdateUserDto does not include bank fields. These are not
sent to nonexistent endpoints or saved only on the device. Add a driver-owned
update workflow with server validation, ownership checks, audit events and
re-verification for changed licence/vehicle documents and bank details. Return
validation and approval states so the UI can display the result. The account UI
currently directs these verified-record changes to the transport team.

## Routing deployment

Self-hosted Nigeria OSRM is live on the existing Hostinger VPS as of 2026-10-23.
The hosted app uses `ROUTING_API_BASE_URL=http://127.0.0.1:5001`; local development
uses `https://app.freebus.cloud/routing`. Abuja and Lagos route checks passed
through both HTTPS and the app proxy. See `../deploy/osrm/README.md` for metrics,
map updates, service operation and the web runtime recovery performed at restart.

For another deployment, set the web host's server environment
`ROUTING_API_BASE_URL` to the base URL of your own OSRM service and restart the
matching production build. Example shape: `https://routing.your-domain`.
Do not append `/route/v1/driving`; the app supplies that path. No private
credentials should appear in a NEXT_PUBLIC variable. The route proxy validates
coordinates and OSRM geometry, times out after eight seconds, and caches routes
server-side for ten minutes. It never changes the server's fare calculation.

Production fails with a clear routing-unavailable state until this is configured.
The public `router.project-osrm.org` demo is restricted to non-commercial testing
and supplies no uptime guarantee. It remains available only for local development.
Source: https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server

For a self-hosted service, use a Nigeria OSM extract and the official OSRM car
profile. Prepare the same data with `osrm-extract`, `osrm-partition`, then
`osrm-customize`, and serve it with `osrm-routed --algorithm mld`. Use the same
pinned OSRM image for preprocessing and serving. Put the service behind your
HTTPS reverse proxy, monitor it, and refresh its map data periodically.
Official deployment guide: https://github.com/Project-OSRM/osrm-backend#quick-start
This deployment reuses the owner's existing VPS; no additional server was purchased.

## Map storage

Tiles are public image files, not small preferences. SharedPreferences is not
suitable for map imagery. The Android cache is bounded, respects HTTP freshness,
and can be cleared by Android under storage pressure; it is not an offline map
package. Requests only follow maps actually viewed; there is no bulk download,
area prefetch or automatic city download.

The current OpenStreetMap standard tile service prohibits offline area downloads.
A future Download Abuja button needs your own tiles/MBTiles source or a provider
licence that explicitly permits offline use, storage limits and an update policy.
Source: https://operations.osmfoundation.org/policies/tiles/

## Android warning and distribution

The supplied images show two different warnings: the file-opening application
warns about an APK attachment, and Play Protect says it has not seen this
publisher before. A valid release signature proves the APK's signing identity;
it does not register the developer with Google or guarantee warning-free sideloads.
The existing K-Rides signing identity is retained for updates.

Use Google Play Console internal/closed testing to distribute via Play instead
of forwarding APKs as chat attachments. This requires the owner's Play Console
account, app setup and applicable declarations/review. An AAB is an upload bundle,
not a file testers can install directly. Do not disable Play Protect or change
signing keys to try to suppress the warning. If Google misclassifies the app,
submit it through Google's official verification appeal workflow.

- https://support.google.com/googleplay/android-developer/answer/9845334
- https://support.google.com/googleplay/android-developer/answer/2992033

## Acceptance testing

Automated checks do not replace a signed-in device test. Check account PATCH
permissions against production; history search/pagination with more than 100
rides; successful/unavailable OSRM routes in Abuja; actual backend bank release;
repeat tile requests, expiry and eviction; slow page navigation/error recovery;
and a full driver/passenger ride, including screen-off GPS and reconnection.

## Verification completed on 21 October 2026

- Production web build passed with Next.js Webpack (the default compiler stalled
  in the restricted environment and was stopped). TypeScript and changed-file
  lint checks passed.
- 74 focused web tests passed, including mapping, bank-detail visibility, account
  isolation, profile loading and admin wire contracts.
- The built production route endpoint passed a local OSRM integration check:
  road shape/metrics returned correctly, invalid inputs returned 400, NoRoute
  returned 502, and an unset production routing host returned 503 without making
  any upstream request. No live external routing server was used for that check.
- Android analysis, two Flutter widget tests, five bridge tests and six native
  release unit tests passed. Loading visibility and cache URL restrictions are
  covered.
- Release APK and AAB signatures verified against the existing K-Rides signing
  certificate; APK debug/test-only flags are off. Physical device tracking and
  real production account mutations still require the acceptance tests above.
