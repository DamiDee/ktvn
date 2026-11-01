# Rental requests and password reset integration

Implemented 1 November 2026 against the accompanying backend contracts.

- Passenger entry: Schedule → Request a rental (`/rides/rentals`). At least 24 elapsed hours, future start, free-text location and requirements. Pending requests support full replacement edits and confirmed permanent deletion. Assigned requests are read-only.
- Admin entry: Rental Requests (`/admin/rentals`). Filter pending/assigned, review customer contact, arrange offline, then confirm Mark assigned. assignedBy is an administrator, never a driver. No prices, payments, car inventory, company registration or rental completion state are invented.
- Rental lists use pages of 20 and offset pagination, focus refresh, explicit refresh and polling. Mutations are never automatically retried. An uncertain result blocks further changes until the customer refreshes and reviews the list.
- Live forgot password (`/forgot-password`): public email request, six-digit string OTP and new password/confirmation, generic account-neutral copy, 60-second resend cooldown. No separate verification call. Success clears the local account boundary and query cache and provides a login link. Passwords and codes stay in component memory only.
- Existing demo password-reset behavior remains only in configured demo mode. Real accounts use the API.

## Backend deployment prerequisites

Apply migrations `2026-11-01-000000_rental_requests` and `2026-11-01-010000_password_reset`, plus the existing email-outbox migration. Configure the documented JWT secret and mail worker/provider settings on the backend. No backend migration or production deployment was performed from this frontend repository.

Session cookies authenticate rental calls using the existing API client. Reset calls omit credentials and use the configured Freebus API base. Participant contact reads remain subject to backend permissions. Other devices' JWT sessions are not revoked by the supplied password reset API.

## Validation

Contract tests cover duration boundaries, strict payloads, pagination, bodyless assignment, 204 deletion, conflicts, uncertain writes without retries, OTP leading zeros, password preservation, credential omission and plain-text errors. Production email delivery, production rental migrations and role permissions require verification on the deployed backend.
