Use the following as a **master design + frontend-generation prompt** for Figma AI, Lovable, v0, Replit, Cursor, Claude Code, or any other UI/product-generation tool. It is intentionally detailed so the generated product does not reduce the idea to “just another ride-hailing dashboard.”

---

# MASTER PROMPT — KOINONIA VERIFIED TRANSPORTATION NETWORK

Design and build a **premium, modern, responsive web application** for the **Koinonia Global Verified Transportation Network**, a members-only transportation platform that connects verified Koinonia members with verified drivers for safe transportation to and from ministry events.

The product has two transportation tracks operating inside the same system:

* **Track A — Volunteer Driver**

  * Completely free
  * No fare
  * No payment prompt
  * No compensation
  * Driver serves voluntarily

* **Track B — Professional Driver**

  * Paid transportation
  * Transparent fares
  * Private and shared rides
  * Receipts
  * Driver earnings
  * Payment-status visibility

Both tracks must share the same safety and trust standard:

**Member verification → Driver verification → Vehicle verification → Ride matching → Live trip tracking → SOS → Two-way ratings → Administrative oversight.**

This should feel like a combination of:

* the interaction polish of **Apple**
* the transportation clarity of **Uber**
* the map experience of **Bolt**
* the clean analytics/dashboard polish represented in the supplied reference images
* a premium fintech/SaaS visual system
* strong editorial typography
* soft luxury
* subtle futuristic transportation technology

Do **not** copy any reference image directly.

Instead, extract their visual principles and reinterpret them for this transportation product.

---

# 1. OVERALL DESIGN GOAL

The product should immediately communicate:

**Trust. Safety. Community. Precision. Calm. Premium technology.**

It must not feel like:

* a generic Bootstrap admin dashboard
* a church website
* a cheap taxi template
* an overly corporate banking portal
* a clone of Uber
* an overly playful consumer app
* a cluttered logistics dashboard

The experience should feel deliberately designed.

Imagine:

> “What if Apple designed a private verified transportation network for a highly organised global community?”

Every interaction should feel thoughtful.

---

# 2. DESIGN DIRECTION FROM THE ATTACHED REFERENCES

Use the uploaded references as inspiration for the following elements.

## A. Deep dark-green / charcoal navigation surfaces

Take inspiration from the first dashboard reference.

Use a sophisticated dark tone for navigation such as:

* deep forest green
* charcoal green
* graphite
* dark slate

Example visual direction:

```text
#102C28
#173632
#1C3330
#1E2525
```

Do not make the entire app dark.

Use dark colour strategically for:

* sidebar
* floating navigation
* important map panels
* driver cards
* premium highlighted states

---

# 3. WARM GOLD / MUSTARD ACCENT

The first reference uses gold/mustard very effectively.

Use a warm premium gold as one of the main brand accents.

Example direction:

```text
#D6A527
#DCAA22
#E0AD28
#C99923
```

Use gold for:

* primary CTAs
* active navigation details
* ride-route highlights
* verified highlights
* route markers
* progress states
* important statistics
* subtle icons

Avoid making everything gold.

It should feel premium, not ornamental.

---

# 4. SECONDARY MODERN ACCENT

Borrow the clean lavender/purple energy from the second and third reference images.

Use a restrained secondary purple/lilac colour for:

* analytics
* selected pills
* visual data
* professional-driver financial widgets
* chart states
* secondary highlights

Example direction:

```text
#6559E8
#786CE8
#8476EF
```

Purple should never compete with the core deep-green + gold identity.

---

# 5. BACKGROUND SYSTEM

Use soft neutral environments inspired by the references:

```text
Warm White
#FAFAF8

Soft Grey
#F4F5F3

Cool Mist
#EDF2F1

Light Lilac Grey
#F1F0F7
```

Avoid pure white everywhere.

Create subtle layering between:

* page background
* card
* nested card
* modal
* map overlay
* elevated control

---

# 6. CARD DESIGN

Use highly refined cards with:

* 20–32px radius
* thin translucent borders
* soft inner highlights
* extremely controlled shadows
* slight glass effects where appropriate
* generous whitespace
* very subtle background gradients

Cards should feel closer to macOS/iOS widgets than ordinary website panels.

Example hierarchy:

```text
Page Surface
    ↓
Primary Card
    ↓
Nested Information Tile
    ↓
Interactive Pill / Micro-Control
```

Avoid hard boxy divisions.

---

# 7. APPLE-LEVEL TYPOGRAPHY

Typography is extremely important.

Use:

**Primary**

* SF Pro Display / SF Pro Text where legally/system available

Fallback:

* Inter
* Geist
* Manrope

Prefer:

```text
font-family:
-apple-system,
BlinkMacSystemFont,
"SF Pro Display",
"SF Pro Text",
Inter,
sans-serif;
```

Use an intentional type scale.

### Display

Large hero:

```text
56–72px desktop
38–48px tablet
32–40px mobile
font-weight: 600–700
letter-spacing: -0.04em
```

### Page Title

```text
32–42px
font-weight: 600
letter-spacing: -0.03em
```

### Section Title

```text
22–28px
font-weight: 600
```

### Card heading

```text
15–18px
font-weight: 600
```

### Body

```text
15–17px
line-height: 1.5–1.7
```

### Metadata

```text
12–14px
font-weight: 500
```

Avoid excessive bold text.

Typography must feel calm and editorial.

---

# 8. ICONOGRAPHY

Use lightweight icons similar to:

* SF Symbols
* Lucide
* Phosphor
* Heroicons

Use:

* rounded strokes
* 1.5px–2px stroke
* simple geometry
* consistent proportions

Avoid cartoonish icons.

---

# 9. NAVIGATION STYLE

Take inspiration from the pill-shaped navigation and vertical rails in the references.

Desktop:

* left navigation rail/sidebar
* rounded container
* active section displayed as a soft pill
* icons + short text
* user avatar/profile near bottom or top
* notification indicator
* compact active-ride status

Tablet:

* collapsible rail

Mobile:

* premium bottom navigation

Passenger:

```text
Home
Rides
Safety
Profile
```

Volunteer Driver:

```text
Home
Requests
Service
Trips
Profile
```

Professional Driver:

```text
Home
Requests
Trips
Earnings
Profile
```

Admin:

```text
Dashboard
Live Rides
Verification
Drivers
Passengers
Incidents
Quality
Reports
```

---

# 10. MOTION DESIGN SYSTEM

Motion should feel similar to:

* Apple Maps
* Apple Wallet
* Uber
* Bolt
* premium fintech applications

Avoid exaggerated bouncy animations.

Use controlled spring animations.

Suggested:

```text
quick interaction:
150–180ms

card transitions:
220–280ms

page transitions:
300–450ms

map movement:
600–1200ms depending on distance

spring:
damping 18–28
stiffness 160–240
```

Use motion for meaning.

---

# 11. MICRO-INTERACTIONS

Include polished micro-interactions.

Examples:

### Button

On hover:

* slight elevation
* 1–2% scale change
* subtle highlight

On click:

* soft compression

### Navigation

Active pill glides between navigation items.

### Toggles

Smooth sliding indicator.

### Cards

Hover:

* 2–4px lift
* subtle border glow
* shadow refinement

### Verification badge

Tiny animated checkmark when verification completes.

### Payment success

Soft expanding check animation.

### Driver acceptance

Driver card smoothly transforms from “Searching” state into matched-driver card.

### Rating

Stars gently illuminate progressively.

---

# 12. CUSTOM PAGE TRANSITIONS

Use transitions rather than abrupt route changes.

For example:

```text
Request Ride
↓
Searching

the ride-request form gently collapses,
the map expands,
and a matching status card floats upward.
```

Then:

```text
Searching
↓
Driver Found

matching animation fades away
driver vehicle appears on map
driver profile card slides upward
```

---

# 13. CUSTOM LOADING EXPERIENCE

Do not use generic circular spinners as the default loading treatment.

Create transportation-specific loaders.

## Main loading screen

Display:

* minimal Koinonia transportation mark
* softly animated route line
* small moving vehicle marker
* subtle glow
* loading message

Example:

> Preparing your journey

Animate a dot moving along a curved route.

---

# 14. MAP LOADING

Instead of a spinner:

* display simplified map skeleton
* roads fade into view
* location marker softly pulses
* route line draws itself

Text:

> Locating you...

---

# 15. RIDE MATCHING LOADER

Create an engaging matching experience.

Map should be visible.

Animate:

* current passenger marker
* subtle expanding search radius
* nearby driver markers
* route candidates briefly appearing/disappearing

Messaging should rotate gently:

> Finding verified drivers nearby

> Looking for drivers heading your direction

> Checking available routes

Do not make the copy feel alarming.

---

# 16. MAP EXPERIENCE

The map is one of the visual centres of the product.

Even with mocked/non-live location data, it must **behave as though it is live**.

Take inspiration from:

* Uber
* Bolt
* Apple Maps

Use:

* smooth animated route lines
* softly moving vehicle marker
* pickup and destination pins
* curved route lines
* map recenter animation
* ETA card
* driver proximity animation

---

# 17. VEHICLE MAP ANIMATION

When a ride is active:

animate the car gradually along the route.

Do not teleport markers.

Use interpolated movement.

The vehicle should rotate slightly based on route direction.

When vehicle approaches passenger:

* camera subtly zooms in
* passenger pickup marker pulses
* ETA decreases
* card changes from:

> Driver approaching

to:

> Driver is nearby

then:

> Driver has arrived

---

# 18. MAP ROUTE ANIMATION

When route first loads:

animate route stroke using a path-drawing animation.

The line should appear to grow:

```text
origin ───────────────→ destination
```

Use gold for primary route.

Alternative muted routes may use transparent grey.

---

# 19. LANDING PAGE

Create an exceptional public landing page before authentication.

It should feel like a premium technology product, not a brochure.

---

# 20. LANDING PAGE — HERO

Large elegant typography:

> **Move together. Travel with confidence.**

Alternative supporting line:

> A verified transportation network built for the Koinonia community.

Explain:

> Find trusted volunteer or professional drivers, travel with live trip visibility, and stay connected from departure to destination.

Primary CTA:

**Find a Ride**

Secondary CTA:

**Become a Driver**

Use a large interactive product mockup beside or below hero.

---

# 21. HERO VISUAL

Create an animated transportation interface showing:

* location map
* driver car moving
* passenger pickup
* verified driver card
* ETA
* route
* Volunteer / Professional selector
* live tracking indicator

Use floating glass UI cards around map.

Example cards:

```text
Verified Driver
Chinedu O.
★ 4.9

Toyota Camry
Blue
ABC-123-XY

ETA
4 min
```

---

# 22. LANDING PAGE TRUST SECTION

Headline:

> Verification isn't a badge. It's the foundation.

Visual sequence:

```text
Member Identity
↓
Driver Licence
↓
Vehicle Documents
↓
Physical Inspection
↓
Verified Driver
```

Animate checkmarks as user scrolls.

---

# 23. TWO TRANSPORTATION TRACKS SECTION

Create two elegant cards.

## Volunteer

**Ride through service**

Verified members offer available seats freely.

Include:

* no fare
* verified driver
* tracked ride
* ratings
* ministry oversight

CTA:

> Explore Volunteer Rides

## Professional

**Reliable paid transportation**

Verified professional drivers provide transparent paid rides.

Include:

* upfront fare
* private/shared
* receipts
* tracking
* verified driver

CTA:

> Explore Professional Rides

Avoid making Volunteer feel like the inferior tier.

---

# 24. SAFETY SECTION

Create dramatic but calm UI.

Headline:

> Every journey stays visible.

Show:

* active ride map
* Share Trip
* SOS
* vehicle details
* live location
* admin monitoring

Use an animated route.

---

# 25. SHARED RIDES SECTION

Explain:

> Share the journey, not the uncertainty.

Show a vehicle seat graphic:

```text
Driver

Passenger 1
Passenger 2
Passenger 3
```

Maximum:

**3 passengers**

Example fare card:

```text
Route Fare
₦1,500

3 riders
₦500 each

2 riders
₦750 each
```

---

# 26. DRIVER SECTION

Headline:

> Already heading there? Take someone with you.

Show driver dashboard.

Volunteer side:

* service confirmation
* destination
* passengers
* hours served
* badges

Professional side:

* online status
* requests
* earnings
* receipts

---

# 27. LANDING PAGE ADMIN / TRUST SECTION

Show behind-the-scenes platform oversight:

* verified drivers
* live rides
* SOS monitoring
* verification queue

But avoid exposing private information.

---

# 28. LANDING PAGE FINAL CTA

Headline:

> Transportation built around trust.

Buttons:

**Request a Ride**

**Become a Driver**

Footer:

* About
* Safety
* Terms
* Privacy
* Driver Information
* Help

---

# 29. ONBOARDING EXPERIENCE

Create a premium 3–5 step onboarding flow.

Use full-screen visuals with minimal text.

---

# 30. ONBOARDING 1 — WELCOME

Headline:

> Welcome to a safer way to move together.

Visual:

animated route with multiple community members converging toward one destination.

CTA:

**Continue**

---

# 31. ONBOARDING 2 — VERIFIED COMMUNITY

Headline:

> Every rider. Every driver. Verified.

Explain that passengers and drivers belong to the verified community.

Animate identity cards receiving verified checkmarks.

---

# 32. ONBOARDING 3 — CHOOSE YOUR RIDE

Show:

Volunteer

and

Professional.

Clarify:

Volunteer:

> Free. Given in service.

Professional:

> Paid. Transparent and predictable.

---

# 33. ONBOARDING 4 — LIVE SAFETY

Headline:

> Your journey doesn't disappear after you enter the car.

Show:

* live route
* Share Trip
* SOS
* trusted contact

---

# 34. ONBOARDING 5

Headline:

> Ready when you are.

Buttons:

**Create Account**

**Sign In**

---

# 35. SIGN-UP PAGE

Create a spacious premium registration page.

Desktop:

split-screen.

Left:

* elegant visual map animation
* short trust statement

Right:

registration form.

Components:

* Full Name
* Member ID / membership identifier
* Email
* Phone
* Password
* Confirm Password
* terms checkbox
* Create Account

Social login only if product later approves it.

---

# 36. LOGIN PAGE

Maintain same premium aesthetic.

Headline:

> Welcome back.

Fields:

* email / phone / member identifier
* password
* show/hide password
* remember me
* forgot password

CTA:

**Sign In**

Secondary:

> New here? Create account

Add subtle animated map in background.

---

# 37. PASSWORD RESET

Create:

1. account identifier
2. verification
3. new password
4. success

Use seamless transitions between steps.

---

# 38. MEMBERSHIP VERIFICATION SCREEN

Show a premium verification state card.

States:

```text
Unverified
Checking
Verified
Action Required
Rejected
```

Verified:

animate checkmark.

Text:

> Membership confirmed

---

# 39. PASSENGER DASHBOARD

This should be one of the most beautiful screens in the product.

Desktop composition inspired by the uploaded dashboards:

### Left / main area

* Request Ride card
* map
* active journey / recent rides

### Right

* current event / destination info
* safety status
* recent drivers
* trip sharing
* notifications

Use asymmetric card layout.

---

# 40. PASSENGER DASHBOARD HEADER

Greeting:

> Good evening, Grace.

Subtext:

> Where are you heading today?

Quick profile:

* avatar
* verified badge

Notification bell.

---

# 41. REQUEST RIDE CARD

Large floating control.

Controls:

### Track segmented control

```text
Volunteer | Professional
```

### Ride Type

```text
Private | Shared
```

### Pickup

Current location

### Destination

Search field.

### Track B only

Estimated Fare

### CTA

**Find a Ride**

Use large rounded button.

---

# 42. SEGMENTED CONTROLS

Take inspiration from Apple's iOS segmented controls.

Selected:

* dark forest or gold
* white text

Unselected:

* light grey
* dark text

Animate sliding selection background.

---

# 43. TRACK A BEHAVIOUR

When Volunteer selected:

remove the fare component entirely with a smooth collapse animation.

Do not show:

```text
₦0
```

Instead show a subtle label:

> Volunteer ride · No payment required

---

# 44. TRACK B BEHAVIOUR

When Professional selected:

animate fare panel into view.

Show:

```text
Estimated fare
₦1,500
```

Shared:

```text
Estimated share
₦750
```

---

# 45. SEARCHING FOR RIDE SCREEN

Map takes visual priority.

Show a floating bottom/side sheet.

Example:

> Finding a verified driver

Secondary:

> Looking for someone already heading toward Gwarinpa.

Animation:

* passenger location pulse
* expanding map rings
* driver markers
* route probes

CTA:

**Cancel Search**

---

# 46. NO DRIVER FOUND

Do not use a depressing error page.

Show calm state:

> No matching driver is available right now.

Options:

**Search Again**

**Try Professional**

**Change Destination**

**Choose Private Ride**

Only present options relevant to current context.

---

# 47. DRIVER FOUND SCREEN

When match occurs:

use a satisfying transition.

Driver card emerges.

Example:

```text
Your Driver

Chinedu O.
Verified
★ 4.9

Toyota Camry
Blue
ABC-123-XY

ETA
4 min
```

Buttons:

**View Journey**

**Share Trip**

Secondary:

Cancel ride.

---

# 48. DRIVER APPROACHING

Large map.

Bottom floating sheet.

Status:

> Chinedu is on the way.

ETA:

> 4 min

Animate vehicle along route.

---

# 49. DRIVER NEARBY

When car gets close:

subtle haptic-style visual animation.

Status:

> Your driver is nearby.

Emphasise:

* vehicle colour
* plate
* model

---

# 50. DRIVER ARRIVED

Create high-visibility card:

> Your driver has arrived.

Vehicle:

```text
Blue Toyota Camry
ABC-123-XY
```

CTA:

**I'm at the pickup point**

Only include passenger confirmation if product approves that mechanic.

---

# 51. ACTIVE RIDE SCREEN

Full map.

Use a floating information panel inspired by Uber/Bolt.

Show:

* live route
* vehicle
* destination
* ETA
* driver
* vehicle plate
* ride type
* current passengers if shared

Persistent controls:

**Share Trip**

**SOS**

---

# 52. SOS DESIGN

SOS should be visible but not visually terrifying.

Use red only here and for incidents.

Button:

> SOS

Potential interaction:

hold to activate.

Animation:

button slowly fills during hold.

After activation:

```text
Emergency alert sent

Your location has been shared with the safety team.
```

Show:

> Safety team responding

when acknowledged.

---

# 53. SHARE TRIP

Use a polished sheet/modal.

Options:

* Copy Link
* WhatsApp
* SMS
* Trusted Contact

Show:

> Live trip sharing active

Use animated link/share icon.

---

# 54. TRIP COMPLETION

Animate map route to completion.

Vehicle marker reaches destination.

Bottom sheet expands:

> You've arrived.

Show:

* destination
* duration
* driver
* Track

Volunteer:

No payment panel.

Professional:

Show fare/payment.

---

# 55. PAYMENT SCREEN

Track B only.

Use premium fintech design inspired by the invoice references.

Show:

```text
Ride Fare
₦1,500
```

For shared:

```text
Your Share
₦750
```

Payment status card.

Do not design a wallet.

States:

* Pending
* Processing
* Paid
* Failed

Successful state:

animated check.

---

# 56. RECEIPT

Design elegant digital receipt.

Include:

* ride ID
* driver
* date/time
* origin
* destination
* private/shared
* route fare
* user share
* payment status

Actions:

**Download**

**Share**

Only if supported.

---

# 57. RATINGS

Use a clean fullscreen or modal card.

Headline:

> How was your ride with Chinedu?

Five stars.

Optional text field.

Submit.

Driver gets similar interface for passenger.

---

# 58. PASSENGER RIDES PAGE

Create sections/tabs:

```text
Active
Upcoming
Completed
Cancelled
```

Use elegant ride cards.

Each shows:

* date
* route
* driver
* track
* type
* fare if Track B
* rating
* status

---

# 59. PASSENGER PROFILE

Show:

* profile photo
* name
* verified-member badge
* rating if product allows
* trips
* trusted contacts
* privacy
* notifications
* location permissions
* support
* sign out

---

# 60. DRIVER ONBOARDING

Treat driver onboarding as a premium professional process.

Use a step indicator:

```text
01 Identity
02 Licence
03 Vehicle
04 Documents
05 Track
06 Review
```

Smooth animated progress bar.

---

# 61. BECOME A DRIVER PAGE

Headline:

> Drive with purpose.

Explain the two options.

Volunteer card.

Professional card.

Both:

> Same verification standard.

CTA:

**Start Application**

---

# 62. DRIVER PERSONAL INFO

Fields:

* full identity
* membership
* government ID
* profile photo

Use drag-and-drop upload area.

Document upload animation:

file floats upward → check appears.

---

# 63. LICENCE STEP

Show:

* driver's licence upload
* licence details
* expiry

Use polished document-preview card.

---

# 64. VEHICLE STEP

Fields:

* make
* model
* colour
* plate number
* vehicle image if required

Create live vehicle summary card.

---

# 65. DOCUMENTS STEP

Upload cards for:

* Insurance
* Vehicle Registration
* Roadworthiness
* Other required documents

Status:

```text
Missing
Uploading
Uploaded
Needs Attention
Expired
```

---

# 66. TRACK SELECTION

Large side-by-side cards.

Volunteer:

> Serve through your journey.

Professional:

> Earn through verified transportation.

Selected card gets:

* animated border
* subtle glow
* checkmark

---

# 67. APPLICATION REVIEW

Show all submitted details in a beautifully structured review page.

Sections collapse/expand.

CTA:

**Submit for Verification**

---

# 68. VERIFICATION PROGRESS

Create a highly polished vertical/horizontal timeline.

Example:

```text
✓ Application Submitted

✓ Documents Received

● Document Review

○ Physical Inspection

○ Final Approval
```

States:

* Approved
* Changes Required
* Rejected

Approved animation:

gold check + subtle confetti-like micro-particles, restrained and premium.

---

# 69. PHYSICAL INSPECTION

Create card:

```text
Physical Inspection

Required
```

If scheduling exists:

* date
* time
* location

Otherwise:

> The verification team will contact you with inspection details.

---

# 70. TRACK SWITCHING

Profile area:

```text
Current Driver Track
Volunteer
```

CTA:

**Request switch to Professional**

After request:

> Awaiting approval

Do not make it an instant toggle.

---

# 71. VOLUNTEER DRIVER DASHBOARD

The visual mood should feel service-oriented rather than financial.

Show:

* service availability
* destination
* pending passenger requests
* active journey
* service hours
* appreciation badges

Primary card:

> Are you available after tonight's service?

Stored information:

```text
Vehicle
Toyota Corolla

Destination
Gwarinpa

Availability
3 seats
```

Actions:

**Confirm**

**Update**

**Not Available**

---

# 72. VOLUNTEER RECOGNITION

Create premium but subtle gamification.

Show:

```text
Service Hours
42

Volunteer Trips
18

Passengers Served
31
```

Badges displayed as tasteful metallic/emblem icons.

Do not make it childish.

---

# 73. PROFESSIONAL DRIVER DASHBOARD

Use a more operational + fintech tone.

Top:

large online toggle.

```text
You're Offline
```

Button:

**Go Online**

Online:

green animated status dot.

Show:

* today's rides
* pending requests
* current destination
* weekly earnings
* rating

---

# 74. PROFESSIONAL AVAILABILITY

Allow:

```text
Private
Shared
```

Potential toggle cards.

Show seats.

Shared:

> Up to 3 passengers.

---

# 75. DRIVER DESTINATION

Large map.

Destination search.

Current location card.

CTA:

**Start Accepting Requests**

After selection:

map draws route.

---

# 76. PASSENGER REQUEST CARD

When driver receives request:

slide card upward.

Example:

```text
Ride Request

Grace A.
Verified
★ 4.8

Pickup
Koinonia Centre

Destination
Life Camp

+5 min from your route
```

Volunteer:

No fare.

Professional:

```text
Fare
₦1,500
```

Actions:

**Accept**

**Decline**

Add countdown ring if requests expire.

---

# 77. DRIVER WAITING SCREEN

Map active.

Status:

> Waiting for passengers heading your direction.

Route visible.

Show:

* destination
* online/confirmed status
* free seats

Use subtle animated location radar.

---

# 78. DRIVER ACTIVE TRIP

Map + passenger sheet.

Show passenger list.

Each passenger:

* image
* name
* verified
* pickup state
* destination

Track B shared rides:

show payment status.

---

# 79. SHARED RIDES

Design seat component inspired by vehicle top view.

Example:

```text
FRONT

Seat 1
✓ Grace

BACK

Seat 2
✓ Daniel

Seat 3
Available
```

Never allow more than 3.

Show:

> 2 of 3 seats filled.

---

# 80. PER-PASSENGER PAYMENT

Track B driver sees:

```text
Grace
₦500
Paid

Daniel
₦500
Pending

Sarah
₦500
Paid
```

Use tiny status chips.

---

# 81. DRIVER COMPLETE TRIP

Volunteer:

> Ride completed

> Thank you for serving.

Show service-hours update.

Professional:

> Ride completed

> ₦1,500 earned

Show receipt status.

---

# 82. DRIVER EARNINGS

Use the visual sophistication of the invoice dashboard references.

Top analytics cards:

* This Week
* Trips
* Avg Rating
* Earnings

Example:

```text
This Week
₦42,300

Trips
18

Avg Rating
4.9
```

Include elegant chart.

Recent trips:

```text
Wuse II
₦1,200

Gwarinpa
₦900

Garki · Shared
₦500
```

CTA:

**View All Receipts**

---

# 83. DRIVER TRIPS

Tabs:

```text
Active
Completed
Cancelled
```

Filter:

Volunteer / Professional if driver has history from both tracks.

---

# 84. DRIVER PROFILE

Include:

* verified status
* current track
* rating
* vehicle
* vehicle verification
* documentation
* trips
* recognition or earnings
* track switch request

---

# 85. NOTIFICATION CENTRE

Create a beautiful notification drawer.

Categories:

* Ride
* Verification
* Payment
* Safety
* Service

Examples:

> New ride request

> Your driver has arrived

> Your verification has been approved

> Confirm your availability for tonight's service

Unread notifications have subtle dot.

---

# 86. ADMIN EXPERIENCE

Admin should feel more like a modern control centre than a generic CMS.

Use the sophisticated dashboard composition from the references:

* clear KPI cards
* floating controls
* high-information density without clutter
* dark map surfaces
* light content cards
* purple/gold statistics

---

# 87. ADMIN DASHBOARD

Top metrics:

```text
Active Drivers
128

Live Rides
14

Pending Verification
6

Open Incidents
1
```

Add:

* Volunteer vs Professional distribution
* completion rate
* ratings
* ride volume

Below:

Live Rides.

---

# 88. ADMIN SOS BANNER

Persistent high-priority banner.

Example:

```text
SOS ALERT

Ride #2291
Track A

Live location shared

Admin responding
```

CTA:

**Open Ride**

Animate subtle pulse.

Do not flash aggressively.

---

# 89. ADMIN LIVE RIDES

Split-screen:

Left/main:

interactive map.

Right/bottom:

live ride table/cards.

Columns:

```text
Driver
Track
Type
Passengers
Status
ETA
```

Filters:

* All
* Volunteer
* Professional
* Shared
* Private
* SOS
* Matching
* In Progress

---

# 90. ADMIN MAP

Driver markers move smoothly.

Use marker states:

* Volunteer
* Professional
* SOS
* idle
* moving

Clicking marker opens ride preview.

Use animated route lines.

---

# 91. ADMIN RIDE DETAIL

Large map.

Side information card:

```text
Ride #2291

Driver
Brother Emeka

Track
Volunteer

Vehicle
Toyota Corolla
Blue
ABC-123-XY

Passengers
2
```

Show:

* timeline
* route
* events
* SOS
* incidents
* rating after completion
* payment status Track B

---

# 92. ADMIN VERIFICATION QUEUE

Use polished table/cards.

Columns:

* Applicant
* Track
* Documents
* Vehicle
* Inspection
* Submitted
* Status

Filters.

Click row opens detail.

---

# 93. ADMIN VERIFICATION DETAIL

Use split panel.

Left:

applicant summary.

Main:

tabs:

```text
Identity
Licence
Vehicle
Documents
Inspection
History
```

Actions:

**Approve**

**Request Changes**

**Reject**

Use confirmation modals.

---

# 94. ADMIN DRIVERS

Searchable directory.

Filters:

* Volunteer
* Professional
* Verified
* Pending
* Flagged
* Active

Cards/table show:

* avatar
* name
* track
* rating
* trips
* vehicle
* verification

---

# 95. ADMIN PASSENGERS

Similar people-management view.

Show:

* avatar
* member
* verified status
* rating if enabled
* rides
* incidents

---

# 96. ADMIN INCIDENTS

Use priority-focused layout.

Tabs:

```text
Open
Under Review
Resolved
```

Cards:

```text
Incident #1023

Ride #2291

Safety Concern

Opened 8 min ago
```

---

# 97. INCIDENT DETAIL

Show:

* ride
* participants
* route
* incident description
* timeline
* SOS history
* ratings
* admin notes

Actions:

* Acknowledge
* Assign
* Escalate
* Resolve

---

# 98. QUALITY FLAGS

Create a clean risk-review table.

Example:

```text
Chinedu O.

Average Rating
2.7

Low Ratings
4

Trips
36
```

CTA:

**Review**

---

# 99. REPORTS

Use beautiful analytics design inspired strongly by the invoice/dashboard references.

Cards and charts for:

### Adoption

* rides requested
* rides completed
* passengers
* drivers

### Verification

* approval rate
* average verification time

### Ride Performance

* match rate
* completion
* cancellations

### Safety

* incidents
* SOS alerts
* resolution time

### Ratings

* passenger
* driver

### Retention

* repeat passengers
* driver retention

### Savings

* Volunteer savings
* Shared Ride savings

Use elegant graph animations.

---

# 100. ERROR DESIGN

Do not show generic:

```text
Error 500
Something went wrong
```

Use contextual UX.

Example location:

> We couldn't access your location.

> Enable location access to continue your ride request.

CTA:

**Enable Location**

---

# 101. OFFLINE EXPERIENCE

When internet drops:

show subtle toast/banner:

> You're offline. Some journey updates may be delayed.

When reconnecting:

> Reconnecting...

When restored:

> You're back online.

Do not unnecessarily block the whole screen.

---

# 102. MAP FAILURE

Maintain last-known map visual where safe.

Display:

> Live location is temporarily unavailable.

Do not replace the entire page with an error screen.

---

# 103. SKELETON STATES

Use soft skeletons for:

* driver cards
* ride lists
* stats cards
* verification records
* earnings

Skeletons should preserve actual layout shape.

---

# 104. EMPTY STATES

Design custom illustrations/icons.

Examples:

### No rides

> Your journeys will appear here.

### No driver

> No matching driver is available yet.

### No earnings

> Your completed professional rides will appear here.

### No badges

> Every volunteer journey adds to your service story.

### Admin all clear

> No open incidents.

---

# 105. HOVER STATES

Desktop must feel interactive.

Cards:

* slight lift
* cursor feedback
* soft border change

Buttons:

* subtle glow
* darker/lighter fill

Table rows:

* gentle highlight

---

# 106. ACCESSIBILITY

Maintain:

* WCAG-friendly contrast
* keyboard navigation
* visible focus states
* minimum touch targets
* semantic forms
* accessible maps alternatives
* proper ARIA where necessary
* reduced-motion support

Do not rely exclusively on colour for:

* payment
* verification
* SOS
* ride status

Pair colour with text/icon.

---

# 107. RESPONSIVE DESIGN

This must feel native-like on mobile even though it is a web app.

## Desktop

Use dashboard composition.

## Tablet

Collapsible navigation.

## Mobile

Ride experiences become:

* full-screen map
* floating bottom sheets
* sticky CTA
* bottom navigation

Do not simply shrink desktop layouts.

---

# 108. MOBILE RIDE UX

On mobile:

map occupies most viewport.

Ride details are inside draggable bottom sheet.

Example heights:

```text
Collapsed
20%

Medium
45%

Expanded
85%
```

Similar to Uber/Bolt/Apple Maps.

---

# 109. MOBILE DRIVER UX

Large controls.

Go Online:

full-width.

Ride request:

prominent bottom card.

Accept/Decline:

large thumb-friendly controls.

---

# 110. SAFETY-FIRST MOBILE DESIGN

During active trip:

keep:

* SOS
* Share Trip

within one thumb reach.

Never bury SOS inside menus.

---

# 111. VISUAL STATES

Use consistent status colours.

### Verified

deep green / gold.

### Active

green.

### Pending

gold/amber.

### Professional / analytics

purple accent.

### Error

muted red.

### SOS

strong red.

### Neutral

cool grey.

---

# 112. DESIGN TOKENS

Create reusable tokens.

### Radius

```text
xs 8
sm 12
md 16
lg 20
xl 28
2xl 32
```

### Spacing

Use 4px/8px scale.

### Shadows

Use layered low-opacity shadows, never thick black shadows.

---

# 113. MAP VISUAL STYLE

Map should use a muted theme.

Light:

* pale grey streets
* green/gold route
* minimal POI labels

Dark mode:

* graphite map
* muted streets
* gold route
* high visibility vehicle

---

# 114. DARK MODE

Support elegant dark mode.

Do not merely invert colours.

Use:

```text
Background
#111513

Surface
#171C19

Elevated
#1D2420

Text
#F5F5F2
```

Gold and purple accents remain controlled.

---

# 115. LANDING PAGE MOTION

Use scroll-linked movement:

* route lines draw
* cards float gently
* maps subtly pan
* numbers count up
* verification icons activate
* vehicle follows route

No excessive parallax.

---

# 116. HERO ANIMATION

Initial page load:

1. background fades in
2. headline rises 12–20px
3. map appears
4. route draws
5. driver marker moves
6. information card floats in
7. CTAs appear

Total around 1.2–1.8 seconds.

---

# 117. PAGE TRANSITIONS

Use:

* fade + vertical shift
* shared layout animation
* cross-fade
* spring card expansion

Avoid:

* page flipping
* spinning effects
* exaggerated zooms

---

# 118. SEARCH INPUTS

Destination search should feel like Apple Maps.

Large rounded field:

> Where are you going?

When focused:

* panel expands
* recent destinations appear
* suggested locations show
* keyboard focus polished

---

# 119. FORM UX

For long driver application forms:

* never present giant form on one page
* use steps
* save progress visually
* immediate validation
* clear upload states

---

# 120. DOCUMENT UPLOAD

Drag-and-drop card.

After upload:

```text
Insurance Certificate
PDF

Uploaded successfully
```

Thumbnail/icon.

Actions:

* preview
* replace
* remove

---

# 121. VERIFICATION FEEDBACK

Avoid vague:

> Pending

Show:

> Your driver's licence is being reviewed.

or:

> Physical vehicle inspection is required.

Give users context.

---

# 122. TRUST BADGES

Use tasteful labels:

```text
Verified Member
Verified Driver
Vehicle Verified
```

Do not overuse shields everywhere.

---

# 123. PROFESSIONAL VS VOLUNTEER BADGES

Volunteer:

gold/green.

Professional:

deep green + subtle purple.

Both still share:

**Verified Driver**

---

# 124. ACTIVE RIDE INDICATOR

If user navigates away from ride screen, persistent component appears:

```text
Ride in Progress
12 min remaining
```

Click returns to map.

---

# 125. NOTIFICATION ANIMATIONS

Notification bell:

tiny movement only for new important notifications.

SOS notifications override regular notifications.

---

# 126. MODAL STYLE

Use centred card on desktop.

Mobile:

bottom sheet.

Backdrop:

blurred.

Animations:

spring upward/fade.

---

# 127. TOASTS

Examples:

```text
Ride request sent

Trip sharing enabled

Payment confirmed

Application submitted
```

Use rounded compact toast.

Avoid huge alerts.

---

# 128. CONFIRMATION DIALOGS

Use only for destructive/high-risk actions:

* Cancel ride
* Go offline during active availability
* Reject driver
* Resolve incident
* Activate SOS if confirmation is ultimately approved

---

# 129. FRONTEND STATE MACHINES

Do not build critical application behaviour as random booleans.

Implement formal states.

### Passenger Ride

```text
IDLE
REQUESTING
SEARCHING
AWAITING_DRIVER
MATCHED
DRIVER_APPROACHING
DRIVER_ARRIVED
IN_PROGRESS
COMPLETED
PAYMENT_PENDING
RATING_PENDING
CLOSED
```

---

# 130. DRIVER

```text
OFFLINE
AVAILABLE
DESTINATION_SET
WAITING
REQUEST_RECEIVED
REQUEST_ACCEPTED
PICKUP
IN_PROGRESS
COMPLETED
```

---

# 131. VERIFICATION

```text
DRAFT
SUBMITTED
DOCUMENT_REVIEW
INSPECTION
FINAL_REVIEW
APPROVED
CHANGES_REQUIRED
REJECTED
```

---

# 132. SHARED RIDE

```text
0/3
1/3
2/3
3/3 FULL
```

---

# 133. PAYMENT

```text
FARE_LOADING
FARE_READY
PENDING
PROCESSING
PAID
FAILED
```

Track A:

```text
NOT_APPLICABLE
```

---

# 134. SOS

```text
INACTIVE
ACTIVATING
SENT
ACKNOWLEDGED
RESPONDING
RESOLVED
```

---

# 135. GLOBAL COMPONENT LIBRARY

Create reusable:

* Button
* IconButton
* Input
* SearchInput
* Select
* SegmentedControl
* Toggle
* Modal
* BottomSheet
* Toast
* Avatar
* Badge
* VerifiedBadge
* StatusChip
* UserCard
* DriverCard
* PassengerCard
* VehicleCard
* RideCard
* FareCard
* ReceiptCard
* StatsCard
* Map
* MapMarker
* RouteLine
* ETAChip
* SeatCounter
* Rating
* SOSButton
* Notification
* Timeline
* DocumentUpload
* EmptyState
* ErrorState
* Skeleton
* ChartCard
* MetricCard
* FilterBar

---

# 136. PRODUCT RULES THAT MUST NOT BE BROKEN

### Rule 1

Volunteer rides never show money.

### Rule 2

Maximum shared passengers = **3**.

### Rule 3

Driver identity and vehicle information must be visible before boarding.

### Rule 4

Live trip map must always give passenger confidence about journey state.

### Rule 5

SOS must remain easily accessible during a trip.

### Rule 6

Driver track switching is not an instant toggle.

### Rule 7

Professional earnings are not a wallet.

### Rule 8

Do not imply rides are guaranteed safe.

### Rule 9

Do not imply the platform provides insurance.

### Rule 10

All interfaces must reinforce the same verification standard for Volunteer and Professional drivers.

---

# 137. FINAL VISUAL STANDARD

The final product should feel:

**70% Apple product discipline**

**15% Uber/Bolt transportation UX**

**10% premium fintech dashboard**

**5% community warmth**

It should feel:

* expensive
* calm
* highly usable
* contemporary
* technically sophisticated
* restrained
* safe
* fast
* trustworthy

Not decorative for decoration's sake.

---

# 138. FINAL QUALITY BAR

When evaluating each page, ask:

> Would this look credible in an Apple product keynote?

> Would someone comfortably use this at 11 PM in a crowded car park?

> Can a passenger understand their ride state within two seconds?

> Can a driver understand their next action without reading instructions?

> Can an administrator see an emergency immediately?

> Does the design communicate verified trust without looking bureaucratic?

> Does every animation make the interface clearer?

If the answer is no, refine the page.

---

# 139. EXPECTED OUTPUT

Create the **entire frontend experience**, including:

* Premium landing page
* Responsive header/navigation
* Onboarding
* Sign up
* Login
* Password reset
* Membership verification
* Passenger home
* Ride request
* Volunteer/Paid switching
* Private/Shared switching
* Map
* Animated ride matching
* No-match flow
* Driver matched
* Driver approaching
* Driver arrived
* Active trip
* Share Trip
* SOS
* Ride completion
* Track B payment
* Shared-fare handling
* Receipts
* Passenger ratings
* Passenger ride history
* Passenger profile
* Driver application
* Document uploads
* Licence
* Vehicle
* Verification
* Physical inspection status
* Track selection
* Track switching
* Volunteer dashboard
* Volunteer service confirmation
* Volunteer destination
* Volunteer ride requests
* Volunteer recognition
* Professional dashboard
* Professional availability
* Professional destination
* Professional requests
* Driver active trip
* Shared passenger management
* Per-passenger payment states
* Driver rating
* Driver trips
* Driver earnings
* Driver receipts
* Driver profile
* Notification centre
* Permission states
* Offline states
* Loading states
* Error states
* Empty states
* Admin dashboard
* Admin live rides
* Animated admin map
* SOS response
* Verification queue
* Verification review
* Driver management
* Passenger management
* Incident management
* Quality flags
* Reports
* Responsive desktop/tablet/mobile
* Dark mode
* Accessibility
* Reduced-motion support
* premium page transitions
* micro-interactions
* skeleton loaders
* custom transportation loaders

The final interface should feel like **a production-grade transportation platform rather than a collection of mock screens**.

The defining experience should be:

> **Beautiful enough to impress at first glance, calm enough to inspire trust, and intuitive enough that a person leaving a late-night service can request and understand their ride without thinking about how the interface works.**
