# Passenger scheduling and login reset · 26 October 2026

## Passenger flow

- The first step contains pickup, destination, pickup time in WAT, and **Continue to fare**. Location/map actions appear when editing the relevant address. The map is loaded only when choosing a pin or explicitly opening **Preview route**.
- The next step replaces the editing form with a route/time summary, fare and confirmation. One available ride option is displayed directly; a selector appears only when there are multiple private options. **Change trip details** returns to editing.
- Successful booking clears the form. Confirmation still refreshes the quote, requires another review when the fare changes, and preserves the exact request for retry after an uncertain create response. Tests use synthetic responses and create no production rides.
- Upcoming schedules remain below the form. Completed, cancelled and expired bookings live at `/rides/schedule/history`, reached through the header's **History** navigation action, with a Back link and a new-trip action. Passenger status/date filters and internal result counts are removed. Admin and driver filters remain available.
- History grouping follows server status. An overdue but still-active ride stays visible. Pagination skips pages that contain only the other view's bookings, preserving the real cursor and avoiding unsupported multi-status API parameters.

## Address interaction on iPhone

The address wrapper previously closed suggestions on blur whenever `relatedTarget` was absent. A touch interaction can blur the input before the suggestion's click arrives, removing that option before selection.

Dismissal now follows actual outside pointer/focus events. A null-target blur leaves the options mounted; repeated input taps keep them open, and tapping an already-focused input can reopen suggestions. Focusing the other field closes the previous field. Address and pickup-time inputs use 16px text to avoid iPhone's small-input zoom.

React/DOM tests exercise asynchronous place results, blur-before-click selection, repeated taps, switching fields, optional map preview, map pin confirmation, the two-step booking form, fare changes and uncertain retries. These tests do not emulate Safari's browser engine, virtual keyboard or layout.

The computer/browser service failed to start (`Sky Computer Use service startup request failed` and `transport closed before response`). Consequently, no physical iPhone or Safari visual verification was possible. The local history route returned HTTP 200 and compiled successfully. Before deployment acceptance, check these flows on an iPhone: tap pickup/destination, type and select once, choose a map pin, return from History, and sign in with and without a real active ride.

## Previous ride type after login

Account changes already clear the booking draft. A second path still allowed the current-ride response to restore an old `NO_DRIVERS`, cancelled or completed outcome, making the previous request's ride type take over again. Refresh now restores live rides or updates the same ride already known in this session. Old terminal/out-of-supply outcomes cannot reappear on later focus refreshes or replayed connection events. Outcomes from a newly submitted request and completion of an actual active ride remain visible.

## Google Maps migration requirements

The current implementation uses Nominatim place search, Leaflet/OpenStreetMap rendering and OSRM routing. Search is limited to Nigeria and biased near the pickup when available; the nearby box is a preference rather than a hard FCT boundary. Replacing map tiles alone would not change place-search coverage.

1. Create a Google Cloud project, link billing, and enable Maps JavaScript API plus Places API (New). Add Geocoding and Routes APIs if Google will also supply pin labels, road routes and ETAs. [Places setup](https://developers.google.com/maps/documentation/javascript/place-autocomplete-new), [usage and billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing).
2. Configure a browser key restricted to the app's domains and required APIs; keep any server web-service key separate and private, with suitable server/API restrictions. Set quotas and billing alerts. [Key restrictions](https://developers.google.com/maps/api-security-best-practices).
3. Replace the place-search/reverse-geocoding adapter and map renderer. Configure Nigeria/FCT relevance without limiting suggestions to streets alone, then test actual locations across the FCT before assuming coverage is sufficient. Use autocomplete session tokens and request only needed place fields to manage cost. [Autocomplete](https://developers.google.com/maps/documentation/javascript/place-autocomplete-new), [sessions](https://developers.google.com/maps/documentation/places/web-service/place-session-tokens).
4. Google Places results shown on a map must use a Google map. Update attribution and review cached responses/recent-place storage against the applicable retention rules; the existing OSM cache settings should not be copied blindly. [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies).

No Google APIs were enabled, no key was added, and the provider remains unchanged in this update.

## Verification

- All 274 automated tests passed, including eight React/DOM scheduling interaction tests and the account restoration/replay regressions.
- TypeScript checking, lint for the affected components and whitespace checks passed.
- The new history route compiled and returned HTTP 200 locally.
- `npm run build -- --webpack` completed successfully, including type checking, static generation and the new history route. The default Turbopack attempt remained in compilation and was stopped before switching to Webpack.
- Browser automation could not start, so real iPhone Safari rendering and virtual-keyboard behavior remain unverified.
