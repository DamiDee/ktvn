# Abuja campaign imagery & fluid product refinement

## October 2026 follow-up

Started from the current local checkout, `6308b6d`, including the user's Abuja carousel and journey/mode-switch changes. During the work the local checkout advanced to `c16c840`; those committed changes were preserved. No pull, reset, checkout or commit was performed by this task. The landing page, APIs, booking rules and role permissions were not changed.

## Original artwork

Generated with the built-in image-generation tool, using the supplied Abuja photographs as place references only. These are conceptual campaign scenes, not documentary views or photographs of actual K-Rides staff. Original reference files are preserved but no longer appear in the authentication carousel.

| Asset | Saved project path | Size |
| --- | --- | --- |
| Boulevard & rock | `public/images/abuja/krides-boulevard.webp` | 1122 × 1402, 262 KB |
| City Gate arrival | `public/images/abuja/krides-city-gate.webp` | 1122 × 1402, 166 KB |
| Driver & passenger welcome | `public/images/abuja/krides-welcome.webp` | 1122 × 1402, 214 KB |

All three are used by the shared sign-in/signup carousel. The boulevard artwork also appears in the passenger ride panel. WebP conversion preserves composition; it only compresses the generated PNGs for delivery.

## Product treatment

- Shared page headers use a clearer editorial hierarchy, with an asymmetric surface and a separate sculpted drop layer.
- Free Buses member departure cards have a ticket-like time column and lighter spacing; operational booking behaviour is unchanged.
- Free Buses and paid admin overviews share restrained fluid decoration. Tables and metric cards receive softer surface treatments without losing pagination or readable statuses.
- Primary actions have cobalt gradients, a light upper edge and asymmetric corners. Secondary actions remain quieter, and destructive actions retain their warning colours.
- Passenger search and driver availability panels carry the same visual language. Existing maps and ride transitions remain intact.
- Decorative shapes animate into place over 4.8 seconds, then settle; no continuous content warping. Only the decorative layer is clipped, never labels, focus rings, or QR codes.
- All additions are product-scoped; the public landing route retains its theme.

## Carousel accessibility

Slideshow advances every 8.5 seconds and has an explicit pause/play control. Hover, keyboard focus, hidden tabs and reduced-motion preference suspend autoplay. Artwork selectors are labelled buttons with 44px-high targets, not incomplete ARIA tabs. Copy is separate HTML; no baked-in image text. The image reveal is brief and respects reduced motion. Automatic captions no longer announce repeatedly to screen readers.

## Verification

- TypeScript and lint checks pass.
- All 87 existing tests pass.
- Production build (`npm run build -- --webpack`) passes: all 76 static pages generated successfully.
- A new isolated browser check was prepared but permission was declined. No new screenshots, live responsive checks or automated accessibility results are claimed for this follow-up. The prior overhaul's browser results do not verify these later changes.
- No real API writes or bookings were made.

## Final generation prompts

### 1. abujaGate

Reference images: `/Users/user/Downloads/cf6bfafb3e845278aa6a1e709b4c030a.jpg`, `/Users/user/Downloads/ab0fce851d2504df9a68c9822fc04f86.jpg`

Use case: ads-marketing. Create an ORIGINAL photorealistic premium K-Rides ride-hailing campaign photograph, portrait 4:5. The attached photos are PLACE REFERENCES ONLY, not images to reuse or just filter. Reimagine a fresh eye-level cinematic scene inspired by Abuja's white twin-pylon City Gate, preserving its recognisable architecture in the background. A beautiful graphite sedan with restrained cobalt accent detailing in the middle foreground on a clean road approaching the gate, warm early morning sun, lush realistic landscaping, luminous pale blue sky. A sense of arriving, effortless movement, premium but welcoming Nigerian urban mobility. Editorial automotive photography, believable road geometry and car anatomy, refined ivory, slate, sky-blue colour grade. Main car and gate in central middle 50% of frame; leave calmer darker road area at bottom for HTML headline overlay and clear sky at top. No text, no watermarks, no invented lettering, no logos, no UI, no collage. Original perspective distinctly different from both reference photographs; not documentary geography.

### 2. abujaBoulevard

Reference images: `/Users/user/Downloads/aae5024656ccee85bfbe8f0c32d97cfa.jpg`

Use case: ads-marketing. Generate an ORIGINAL portrait 4:5 photorealistic luxury-but-human ride-hailing campaign photograph for K-Rides. Attached image is a PLACE/MOOD REFERENCE ONLY: Abuja-inspired granite monolith, contemporary skyline and broad curving tree-lined boulevard. Do not reproduce the aerial reference photograph. New composition shot from elevated roadside at a cinematic lower angle: a refined pearl-white sedan with subtly cobalt trim glides along a gentle sweeping boulevard in foreground, monumental rock and Abuja-inspired skyline in middle distance, late-afternoon soft sunlight and huge luminous powder-blue sky. Modern, optimistic, calm, realistic Nigerian city scenery; editorial automotive materials and proportions, realistic markings and traffic. Keep vehicle, recognisable rock and skyline in central middle half to allow responsive crop; quieter dark asphalt foreground for HTML text overlay. Palette cobalt reflections, ivory, charcoal, natural green landscaping. No text, branding, logos, phones, UI, watermark or collage. This is new conceptual campaign artwork inspired by the place, not a claim to exact documentary geography.

### 3. abujaWelcome

Reference images: `/Users/user/Downloads/ab0fce851d2504df9a68c9822fc04f86.jpg`, `/Users/user/Downloads/cf6bfafb3e845278aa6a1e709b4c030a.jpg`

Use case: ads-marketing. Create an ORIGINAL premium photorealistic lifestyle campaign photo for K-Rides ride-hailing, portrait 4:5. Attached photos are Abuja PLACE REFERENCES ONLY, not an edit target or background to paste. A new eye-level composition at a landscaped Abuja pickup bay with the recognisable white City Gate pylons softly visible in background. A friendly Nigerian adult male driver in a clean ivory shirt stands beside an elegant graphite sedan, welcoming a smiling Nigerian adult woman passenger in contemporary pale blue casual clothing; natural candid interaction, no physical contact needed. Door closed, no distorted hands. Humans and vehicle centred in middle half of frame. Premium humane mobility, soft morning light, delicate blue sky, realistic skin and fabric detail, refined ivory/charcoal/cobalt colour story and natural landscaping. Calm darker lower foreground for HTML type overlay, generous top sky. No text, logos, watermarks, copied photograph, collage, UI or exaggerated futuristic objects. Fresh original composition, concept artwork inspired by Abuja not documentary geography.

