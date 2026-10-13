# K-Rides product UI overhaul

## Scope and design direction

Work starts from the current local checkout (`ce60f32`, Paid Rides module), not an older copy. Existing edits to `.env.example`, `map-picker.tsx`, `leaflet-ride-map.tsx`, and the new `map-tiles.ts` are preserved. The public landing page and its marketing components/assets are not redesigned.

The product palette is warm ivory, graphite, cobalt and pale blue. The supplied references informed the spacious editorial composition, photographic panels, rounded floating surfaces and restrained motion; their brands and artwork were not reused.

## Audit and changes

| Finding | Change |
| --- | --- |
| Authentication promoted the old service tracks instead of the current product | New cinematic login/signup shell, shorter copy, consistent product mark and blue primary actions |
| Driver signup was hard to discover and blocked by the signed-in shell | Prominent signup link to public `/driver/apply` |
| Long driver application lacked reassuring feedback | Six-step application, completion meter, completed-step list, “almost there” feedback, back navigation and final review |
| Driver application service only simulates submission | Explicit preview notice, sample-details guidance and honest completion screen; no claim that a live driver account was created |
| Paid-ride navigation hid inactive labels | All five destinations remain labelled, with an animated active pill and generous touch targets |
| Ride screens lacked a consistent visual identity | Branded desktop map panels, original transport imagery, clear search, driver availability and action hierarchy |
| Admin workspaces were disconnected | Paid rides / Free buses switch in the sidebar and page header, including phones |
| Legacy admin overview was crowded | Editorial overview header, clearer metrics, focused quick actions; retired track-distribution promotion removed |
| Legacy service-track promotion remained accessible | Removed signup options/filters, limited paid admin lists to professional records, hid unsupported historical detail views; old operational ride URLs lead to the current paid-rides module |
| Form hints did not match their accessibility references | Shared field hints/errors now have matching IDs |
| Mobile navigation overlays did not trap keyboard focus | Focus enters the drawer, stays inside on Tab, closes on Escape and returns to its trigger |
| Boarding action menu failed the React lint check | Event handlers now remain event handlers, without the render-time function wrapper; API actions are unchanged |

The palette is scoped to product routes using `ProductTheme`. Compatibility aliases recolour existing components and portalled dialogs, while `/` keeps its existing palette. Green/red retain their semantic success/error uses; they are not brand accents. Motion respects reduced-motion preferences. Forms remain usable at narrow widths, with 16px mobile input text to avoid unwanted browser zoom.

## Backend boundaries

- Free Buses remains on the existing live API. This is not a transport-API rewrite.
- Paid-rides admin still uses the existing mock admin services. Its preview banner makes that explicit. The UI switch does not grant backend permissions.
- Only Admin/Root can enter the paid admin preview. Route coordinators keep their existing buses, trips and boarding navigation.
- Driver registration/document upload are still simulated. The application preview does not create an account or transmit documents. Do not enter real identity documents in the preview.
- Paid Rides retains its existing `NEXT_PUBLIC_PAID_RIDES=off|mock|api` switch: development defaults to mock; production defaults to off. No environment setting was changed. Use `mock` explicitly for a production-built design preview; enable `api` only with the backend configured.
- Live login only redirects members/drivers directly to paid rides when that module is in API mode. A real member login is not silently redirected into a simulated account.
- Historic service-track records and schemas are not relabelled as paid rides or deleted. The untouched landing page may still contain its existing marketing copy.

## Generated assets and provenance

Created with the **built-in image-generation tool**. New assets are original, generated campaign illustrations, not documentary photographs of actual drivers or a verified route. Converted to WebP for delivery; existing imagery was not overwritten.

- `public/images/krides-journey-premium.webp`: 1122 × 1402, approximately 165 KB; auth panel and passenger desktop panel.
- `public/images/krides-driver-premium.webp`: 1400 × 1050, approximately 145 KB; onboarding and driver desktop panel.

### Journey image prompt

Use case: ads-marketing. Asset type: cinematic photographic background for a premium Nigerian taxi-hailing app's login/signup editorial panel, not a website screenshot. Primary request: an original high-end transport campaign photograph with the spacious architectural composition and atmospheric quality of the user's references. Scene: a broad curving road winding through the sculptural green hills around Abuja, with a refined modern city skyline subtly visible in the far distance, clear blue morning sky and soft warm sunlight. Subject: a single sleek graphite-colored contemporary sedan on the road in the lower middle of the frame, naturally sized, driving toward the city. Photorealistic, beautifully controlled reflections and realistic asphalt, understated luxury travel magazine art direction. Portrait 4:5 framing suitable for tall responsive cropping. Top third calm sky and atmospheric landscape, bottom third quiet dark foreground suitable for live HTML white text overlay; keep car and road visible in middle. Palette charcoal, stone, pale warm ivory, cool blue atmospheric light; greenery only as natural scenery, no gold branding. No rendered text, no lettering, no badges, no logos, no watermark, no phone mockup, no UI, no collage. This is original imagery, do not reproduce reference brands or layouts.

### Driver image prompt

Use case: photorealistic-natural. Asset type: premium taxi-hailing driver signup editorial photograph for the K-Rides app. Create an original landscape 4:3 photograph of a warm, confident Nigerian male professional driver in his early thirties beside a clean graphite sedan at an elegant contemporary Abuja curbside. He wears a refined light ivory polo shirt and dark trousers, a genuine relaxed smile, standing naturally near the open front door. A Nigerian female passenger in smart-casual clothes is approaching in the softly defocused middle distance, suggesting a welcoming everyday human journey. No staged handshake, no unearned verification badges. Photorealistic skin, believable hands and anatomy, sophisticated natural morning light, pale limestone modern architecture, cool blue reflections on the car. Spacious premium travel editorial composition, driver and vehicle clearly visible near the middle, calm background, clean materials. Palette charcoal, warm ivory, soft cobalt reflected light. No lettering, no logos, no advertisements, no graphic overlays, no watermarks. Not a UI mockup.

## Verification

- Production build: `npm run build -- --webpack` passes.
- TypeScript check passes.
- Lint passes without warnings.
- Existing test suite: 87 passing checks, including the 27 paid-rides tests.
- Browser checks use isolated contexts, simulated admin responses and no live API writes.
- Responsive checks cover desktop plus 390px and 320px authentication, signup, onboarding and ride screens, as well as desktop/mobile admin switching.
- Automated WCAG 2 A/AA and WCAG 2.1 AA scans report no violations on the seven initial light-mode screens: login, signup, application, passenger rides, driver rides, paid admin and Free Buses admin. This is a scoped automated check, not a full accessibility certification.
- Mobile admin drawer focus containment, Escape dismissal and focus restoration were checked.
- Additional browser checks for a fully filled driver application, dark-mode contrast and a fresh coordinator session were not run because the additional browser run was not approved. The coordinator UI guard was inspected in code; existing role-contract tests pass.
- Landing-page source remains unchanged. No credentials, real passenger bookings or live driver records were created for testing.

## Next product work

Connect driver application submission and the paid-rides admin to authoritative backend endpoints before enabling them for real users. Test GPS, location permission recovery, camera/NFC and boarding on physical Android/iOS devices: browser emulation cannot certify device-specific hardware behaviour. Follow up with real riders and coordinators to validate task completion and comprehension, rather than treating visual polish as proof of usability.
