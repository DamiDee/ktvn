ENGINEERING EXECUTION INSTRUCTIONS

Build this as a production-quality frontend application.

Preferred stack:
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui where appropriate
- Framer Motion / Motion for animations
- Lucide icons
- Mapbox or Google Maps abstraction for maps
- TanStack Query for async server state
- Zustand or equivalent lightweight global state where appropriate
- React Hook Form + Zod for forms and validation

Architecture requirements:
- Use reusable components.
- Avoid one giant page component.
- Separate passenger, driver, and admin experiences cleanly.
- Create reusable layouts for each role.
- Model ride lifecycle, verification, payments, SOS, and availability as explicit enums/state machines rather than scattered booleans.
- Keep mock data isolated so APIs can be connected later.
- Create service/repository abstractions instead of putting fetch calls directly into UI components.
- Use TypeScript interfaces/types for all domain models.
- Create responsive desktop, tablet, and mobile layouts.
- Mobile ride screens should use map + draggable/floating bottom-sheet patterns similar to Uber/Bolt.
- Implement dark mode.
- Implement accessibility and reduced-motion support.
- Use skeleton loaders and contextual empty/error states.
- Do not use generic spinners when a custom loading state is specified.

DOMAIN MODELS TO DEFINE

User
Passenger
Driver
Vehicle
DriverVerification
VerificationDocument
Ride
RideRequest
RidePassenger
RideLocation
Payment
Receipt
Rating
Incident
SOSAlert
Notification
VolunteerServiceRecord
VolunteerBadge
DriverEarning
Event

Enums/state models should include:

UserRole:
PASSENGER
DRIVER
ADMIN

DriverTrack:
VOLUNTEER
PROFESSIONAL

RideType:
PRIVATE
SHARED

RideStatus:
IDLE
SEARCHING
AWAITING_DRIVER
MATCHED
DRIVER_APPROACHING
DRIVER_ARRIVED
IN_PROGRESS
COMPLETED
CANCELLED
NO_MATCH

VerificationStatus:
DRAFT
SUBMITTED
DOCUMENT_REVIEW
INSPECTION_REQUIRED
INSPECTION_SCHEDULED
FINAL_REVIEW
APPROVED
CHANGES_REQUIRED
REJECTED

PaymentStatus:
NOT_APPLICABLE
PENDING
PROCESSING
PAID
FAILED

SOSStatus:
INACTIVE
ACTIVATING
SENT
ACKNOWLEDGED
RESPONDING
RESOLVED

DriverAvailability:
OFFLINE
AVAILABLE
DESTINATION_SET
WAITING
REQUEST_RECEIVED
ON_TRIP

SharedSeatStatus:
0_OF_3
1_OF_3
2_OF_3
3_OF_3_FULL

PROJECT STRUCTURE

Use a structure similar to:

src/
  app/
    (public)/
    (auth)/
    passenger/
    driver/
    admin/
  components/
    ui/
    maps/
    rides/
    drivers/
    passengers/
    verification/
    payments/
    safety/
    analytics/
  features/
    auth/
    passenger/
    driver/
    rides/
    verification/
    payments/
    incidents/
    admin/
  lib/
  hooks/
  services/
  stores/
  types/
  mocks/
  constants/

ROUTES

/
 /login
 /signup
 /forgot-password
 /onboarding
 /verify-member

/passenger
/passenger/request
/passenger/matching
/passenger/rides
/passenger/rides/[id]
/passenger/profile
/passenger/safety

/driver/apply
/driver/verification
/driver
/driver/destination
/driver/requests
/driver/rides/[id]
/driver/trips
/driver/profile
/driver/vehicle
/driver/track
/driver/volunteer
/driver/volunteer/confirm
/driver/volunteer/recognition
/driver/professional
/driver/professional/earnings
/driver/professional/receipts

/admin
/admin/live-rides
/admin/live-rides/[id]
/admin/verifications
/admin/verifications/[id]
/admin/drivers
/admin/drivers/[id]
/admin/passengers
/admin/passengers/[id]
/admin/incidents
/admin/incidents/[id]
/admin/quality
/admin/reports

MOCK-FIRST IMPLEMENTATION

Until real APIs exist:
- Build realistic mock data.
- Simulate loading delays.
- Simulate driver movement on maps.
- Simulate ride matching.
- Simulate ride status transitions.
- Simulate payment success/failure.
- Simulate SOS acknowledgement.
- Simulate verification progress.
- Keep simulation code separate from visual components.

MAP SIMULATION

Even without live GPS:
- render a realistic route
- animate the vehicle marker smoothly along the route
- interpolate coordinates rather than teleporting
- rotate vehicle marker according to movement direction
- update ETA progressively
- simulate DRIVER_APPROACHING → DRIVER_ARRIVED → IN_PROGRESS
- use pickup and destination markers
- animate route drawing on initial render

DESIGN SYSTEM

Create tokens for:
- colors
- typography
- spacing
- radii
- shadows
- motion durations
- breakpoints
- status colors

Use the design direction in the master product prompt as the source of truth.

Do not arbitrarily introduce unrelated colors or styles.

IMPLEMENTATION ORDER

Do not attempt every screen in one giant pass.

Build in this order:

1. Design system
2. Public landing page
3. Authentication/onboarding
4. Shared layouts/navigation
5. Passenger core ride flow
6. Driver onboarding/verification
7. Volunteer driver flow
8. Professional driver flow
9. Active ride/map/SOS
10. Payment/ratings/history
11. Admin dashboard
12. Admin verification/live rides/incidents
13. Reports
14. Responsive refinement
15. Animation refinement
16. Accessibility
17. Empty/loading/error states

For each phase:
- make it functional
- make it responsive
- verify types
- remove console errors
- then continue

IMPORTANT PRODUCT RULES

1. Volunteer rides must never display monetary values or payment UI.
2. Shared rides have a maximum of 3 passengers.
3. Driver photo, name, vehicle, vehicle color, and plate must be visible before boarding.
4. SOS must remain easy to reach during active trips.
5. Track switching requires approval and must not behave as an instant toggle.
6. Professional earnings are not a wallet.
7. Do not claim guaranteed safety.
8. Do not imply platform-provided insurance.
9. Both driver tracks use the same verification standard.
10. Preserve clear distinctions between Passenger, Volunteer Driver, Professional Driver, and Admin experiences.

CODE QUALITY

- No duplicated large UI blocks where reusable components make sense.
- No `any` unless absolutely unavoidable.
- No hardcoded status strings scattered across components.
- No inline mock data inside presentation components.
- No huge 1000+ line page files.
- Keep business state separate from presentation where reasonable.
- Ensure linting and type checking pass.

DELIVERABLE EXPECTATION

At the end:
- app runs locally
- routes work
- mock interactions work
- maps visibly animate
- loading/error/empty states exist
- desktop/mobile views are polished
- design is consistent with the attached reference direction
- no obvious placeholder UI remains