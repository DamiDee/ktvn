# Koinonia Verified Transportation Network — Frontend

A members-only verified transportation platform connecting Koinonia members
with verified drivers, across two tracks that share one safety standard.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npx eslint .     # lint
npx tsc --noEmit # type check
```

Node 20+ required. No API keys or environment variables are needed — the app
runs entirely on the mock layer described below.

## Architecture

```
src/
  app/                    routes only; pages stay thin and delegate to features/
    (public)/             landing page
    (auth)/               login, signup, forgot-password, onboarding, verify-member
    passenger/  driver/  admin/
  components/
    ui/                   design-system primitives (Button, Modal, BottomSheet, …)
    maps/                 provider-agnostic map layer
    layout/               app shell, navigation, notification drawer
    marketing/  rides/  drivers/  safety/
  features/               screen-level logic, grouped by domain
  services/               repository abstractions — the only place data is fetched
  mocks/                  fixtures, isolated so real APIs can replace them
  lib/                    geometry, formatting, motion presets, state machines
  types/                  domain models and enums
  constants/              design tokens, navigation, status presentation
  stores/                 lightweight global state (Zustand)
```

Three rules hold the structure together:

1. **No component fetches directly.** Everything goes through `services/`, which
   goes through `services/api-client.ts`. Replacing mocks with a real backend
   means editing `request()` in that one file.
2. **No component hardcodes a status string.** Status labels, tones and human
   phrasing live in `constants/status-presentation.ts`; transitions live in
   `lib/state-machines.ts`.
3. **No mock data inside presentation components.** Fixtures live in `mocks/`.

## State machines

Ride lifecycle, driver availability, verification, payment, SOS and shared
seats are modelled as explicit enums with declared transitions in
`src/lib/state-machines.ts` — not scattered booleans.

```
RideStatus: IDLE → REQUESTING → SEARCHING → AWAITING_DRIVER → MATCHED
          → DRIVER_APPROACHING → DRIVER_ARRIVED → IN_PROGRESS → COMPLETED
          → PAYMENT_PENDING → RATING_PENDING → CLOSED
          (CANCELLED and NO_MATCH branch off)
```

## The map layer

`components/maps/` is provider-agnostic. `MapCanvas` accepts routes, markers
and a viewport; today a self-contained renderer draws them — procedural
terrain, animated route drawing, and vehicle markers interpolated along the
path by distance with heading-based rotation (`lib/geo.ts`,
`features/rides/use-ride-simulation.ts`).

Swapping in Mapbox or Google Maps means writing one component that satisfies
`MapCanvasProps`. No calling screen changes.

The projection fits the container's measured aspect ratio, so routes are never
distorted and markers are never cropped out of frame.

## Product rules enforced in code

| Rule | Where it is enforced |
| --- | --- |
| Volunteer rides never show money | `Ride.fare` / `RidePassenger.fareShare` are optional and simply absent on the volunteer track, so no code path can render ₦0. `RideCard`, `RequestCard` and the fare panel all branch on `track`. |
| Shared rides cap at 3 passengers | `MAX_SHARED_PASSENGERS`, `canAcceptPassenger()`, and `SeatMap` which renders exactly three seats. |
| Driver identity visible before boarding | Driver card shows photo, name, verified badge, vehicle, colour and plate in every pre-boarding state. |
| SOS stays reachable during a trip | `isSosAvailable()` is keyed to the active ride states; SOS sits in the persistent trip controls, never in a menu. |
| Track switching is not a toggle | `TrackSwitchStatus` requires an approval step; there is no direct setter. |
| Professional earnings are not a wallet | Earnings render as a record of completed rides, with no balance or withdrawal affordance. |
| No guaranteed-safety or insurance claims | Safety copy is reviewed throughout; the landing page, onboarding and dashboard all state the limits plainly. |
| Both tracks share one verification standard | One `DriverVerification` model and one `REQUIRED_DOCUMENTS` list for both tracks. |

## Accessibility

- Visible focus rings on every interactive element, never removed.
- Status is always colour **plus** text or icon — never colour alone.
- `prefers-reduced-motion` is honoured globally in CSS and per-component via
  `useReducedMotionSafe`; the ride simulation lands on its endpoint rather than
  animating.
- Modals trap focus, restore it on close, and close on Escape.
- Mobile touch targets are at least 44px.
- Maps carry a text description; the same information is available in the
  surrounding cards.

## Mock layer

`services/api-client.ts` simulates latency (`MockDelay`) and can simulate
failure (`failureRate`) so error states are reachable. Ride matching, driver
movement, verification progress, payment outcomes and SOS acknowledgement are
all simulated, and the simulation code is kept out of the visual components.

Demo sign-in — any password works:

| Identifier | Lands on |
| --- | --- |
| `grace.adeyemi@example.com` | Passenger |
| `emeka.nwosu@example.com` | Volunteer driver |
| `chinedu.okafor@example.com` | Professional driver |
| `deborah.ajayi@koinonia.example` | Admin |

## Design system

Tokens live in `src/app/globals.css` as the single source of truth — colour,
typography scale, spacing, radii, shadows, motion durations and status colours,
with a full dark-mode palette that is redefined rather than inverted.
`src/constants/design-tokens.ts` mirrors only the values JavaScript needs.

Fonts: SF Pro where the system provides it, Inter as the fallback.
