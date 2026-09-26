# City registration and boarding-pass updates

## Registration

Member sign-up (`POST /users`) and admin account creation (`POST /users/admin`)
both require and send a separate `city` string. The street address is not modified.
Member profiles display the returned city; older accounts without it show
“Not provided”. Backend support was confirmed by the product owner; the published
OpenAPI schemas checked on 26 September 2026 still omitted this field.

The searchable **City / area** field covers Abuja / FCT, including districts and
towns rather than only places formally classified as cities. An explicit
“Use … — not listed” option avoids blocking residents whose area is missing.

## Optional live place catalogue

The app works immediately with a non-exhaustive local starter list. To enrich it:

1. Create your own [GeoNames account](https://www.geonames.org/login).
2. Enable free web services in that account's settings.
3. Set `GEONAMES_USERNAME` in `.env.local` and the deployment's server environment.
4. Restart/redeploy the app. No `NEXT_PUBLIC_` prefix is needed.

`GET /api/locations/abuja` queries GeoNames through the server, restricted to
Nigeria (`NG`), FCT (`adminCode1=11`) and populated places (`featureClass=P`). It
reads up to six pages and merges the result with the starter list. A complete
provider result is cached in-process for 24 hours; incomplete results retry after
five minutes. Requests are coalesced within a running server instance. For a large
multi-instance deployment, use a shared cache or a periodically refreshed dataset
to keep within the provider's account limits.

The browser searches locally: typed queries, street addresses, and user details
are never sent to GeoNames. Failed, rate-limited, empty or malformed responses
fall back to saved/local options. The form remains usable while a lookup loads.
Live GeoNames access needs the configured account and was not verified with a
real provider account during implementation; provider success, pagination and
failure paths are covered with test fixtures.

GeoNames does not guarantee complete geographic coverage. `providerComplete`
only means that all pages of this particular provider query were read. It does
not mean “every city in Abuja”. Attribution is shown when provider data is used.

References:

- [GeoNames search parameters](https://www.geonames.org/export/geonames-search.html)
- [GeoNames web-service account setup](https://www.geonames.org/export/web-services.html)
- [GeoNames data licence and service limits](https://www.geonames.org/export/)
- [FCT administrative record](https://www.geonames.org/2352776/fct.html)
- [FCTA location context](https://www.fcta.gov.ng/faq/)

## Boarding pass and overview

- Confirmed tickets retain the API-signed QR image. Once the API reports
  `Boarded`, the QR area becomes a four-second bus-arrival confirmation with the
  passenger, seat and journey details retained.
- The animation is decorative, not GPS tracking. It does not loop, respects
  reduced-motion preferences and is static when printed.
- Completed journeys use a thank-you state. Cancelled trips and cancelled/revoked
  tickets do not show an active QR or a new boarding celebration.
- No boarding state is written by this animation. Existing booking polling
  controls when an externally confirmed boarding appears on the member's screen.
- The admin overview adds next-departure, fleet, meeting-point and workspace cards.
  Counts come from API data, and past departures are excluded from upcoming trips.
- Tailwind dark variants now follow the app's `.dark` theme class rather than an
  independent device preference, matching the existing theme toggle and surfaces.
