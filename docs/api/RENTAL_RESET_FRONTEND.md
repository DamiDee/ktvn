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

## Rental pickup map

The rides home screen and navigation include “Car rental rides” immediately after Schedule. Rental pickup reuses Google place search, current location and map-pin selection. The API currently accepts only a pickupLocation string and rejects extra fields, so the frontend saves the selected address followed by `Coordinates: latitude, longitude` in that field. Editing restores the pin from that suffix. Existing text-only pickups remain editable without invented coordinates. A future structured coordinate API should add validated latitude/longitude fields and migrate this representation explicitly.

## Updated rental contract — 4 November 2026

This section supersedes the earlier bodyless/offline assignment description. The supplied OpenAPI now requires `carType` (`Van`, `SUV`, `Saloon`) on create/update and `{driverId}` on `POST admin/rentals/{id}/assign`. Optional response fields `carType`, `driverId` and `price` are accepted, including legacy omissions/nulls. Assigned drivers are shown through existing contact access.

Vehicle cards use `GET rental/pricing` (singular, as supplied separately), map lowercase pricing keys to the exact enum casing, and show category illustrations. Returned NGN price strings are displayed as listed naira rates; billing period and the response `price` field's units are not specified, so no per-day total is invented. Confirm the billing period and units before adding duration multiplication. Company registration remains off.

Fare estimation retries transient failures once after 5 seconds, under the existing 15-second request timeout. Loading remains visible during retries; the final failure stops the loading state, explains connection versus fare-service trouble, and allows manual retry. Validation/auth errors do not automatically retry. Focus/reconnect do not silently restart exhausted retries.

Password reset already uses email + six-digit OTP + newPassword, matching the supplied OpenAPI. Login now explicitly labels the email reset link. Production mail delivery still requires the backend mail worker configuration.

The owner confirmed pricing amounts are naira. The vehicle picker now also shows approximate equivalents through a currency selector: USD, GBP, EUR, KES, GHS, ZAR and other supported African currencies. `GET /api/rentals/convert?amount=…` converts a bounded NGN amount using the fixed ExchangeRate-API NGN feed, cached for 24 hours; it returns converted amounts rather than redistributing raw rates. Source attribution and rate dates are visible. Data older than 72 hours is rejected. Conversion failure never prevents displaying the original NGN price, and conversions never change the rental payload or payment currency. The daily versus full-period pricing basis remains unconfirmed, so duration multiplication is still intentionally absent.
