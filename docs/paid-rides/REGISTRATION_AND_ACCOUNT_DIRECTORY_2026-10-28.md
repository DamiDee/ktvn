# Registration choice and admin account information

## Registration

`/signup` now opens an account-type choice with two clear paths:

- **Passenger** opens `/signup?role=passenger`, using the existing passenger registration form and endpoint.
- **Driver** opens `/driver/apply`, using the existing six-step application, document preparation, and registration workflow.

Both paths offer **Change account type**. `/signup?role=driver` redirects to the application; missing, unknown, or repeated role query values show the chooser. A query parameter never grants an account role. Passenger registration still creates the existing platform User account. Existing sign-in links and explicit driver-application links remain available.

## Driver contact and personal details

The Drivers table now shows phone numbers. Because the paid-rides `PersonSummary` schema does not include phone, the roster obtains contacts through the existing admin-authorised `GET /users` endpoint and matches records by account ID. Selecting a driver opens their record, which includes a **Contact & personal details** section backed by `GET /users/{id}`.

That section displays the available account information: first and last names, username, email, callable phone, full address, city, country, role, account status, identity verification, identity type/number, and registration/update/last-seen dates. Driver profiles also show track, application status, licence number/class/expiry, Koinonia worker affiliation, department, guarantor name/contact/relationship, profile and vehicle IDs, and submitted photos/documents. Document previews use the existing safe source conversion and open inline, including inside the account management dialog.

A failed profile request leaves the driver's existing email and phone visible and offers **Retry profile**. A response for a different account ID is rejected. Missing fields are labelled rather than inferred. The current User DTO does not return date of birth, gender, a free-text biography, or payout bank details; these were not invented or added to an unsupported endpoint.

## Paid Rides System Users

The Paid Rides admin navigation now includes **System Users** at `/admin/users`. It reuses Free Buses account management because both workspaces share the same platform accounts. It does not create a second account database or silently limit the directory to drivers. Role and driver-track filters can narrow the list.

The Paid Rides table includes all available account fields and the relevant driver profile fields, including contact, address, account/identity status, track, approval, licence and guarantor details. It offers search, sorting, client-side pagination, and filters for:

- Role
- Active/deactivated account
- Verified/unverified identity
- City/area
- Driver track (Both is included under either track)
- Registration date range, using Nigeria's calendar day

Dates sort chronologically. Wider tables scroll horizontally on desktop; the existing table component provides labelled record cards on smaller screens. **Manage** opens the full profile and the existing role, activation, deactivation, deletion, and passenger-strike actions. Existing confirmations and restrictions remain: an account cannot act on itself, only Root can manage oversight roles/accounts, and the API remains responsible for authorisation. Actions apply to the shared platform account in both workspaces. Successful changes invalidate both workspaces’ admin/account queries so role and status changes appear immediately.

Free Buses uses the same reusable account table with its Member terminology and a smaller set of columns. Its account management endpoints and permissions are unchanged. In explicit demo mode, the Paid Rides System Users page explains that a live account connection is required, rather than attempting live mutations against demo records.

## Verification

- Full suite: 299 tests passed, including the new registration routing, filter composition, Both-track inclusion, Nigeria date boundaries, phone link validation, confirmation-before-mutation, and self/oversight safeguards.
- Final focused checks: 10 passed. Scoped ESLint, TypeScript, and the production Webpack build passed. Generated development route types for the temporary preview were cleared before the successful build.
- Browser verification covered the actual public passenger and driver paths at phone size, plus filters and profile details using a temporary sample-account preview. No registration was submitted and no real account was modified. The preview route was removed before the production build.
- Live admin profile reads/mutations were not exercised against real accounts because no authenticated admin session was provided for this run. The implementation uses documented existing endpoints.
