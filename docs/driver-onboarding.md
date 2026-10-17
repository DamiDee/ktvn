# Driver onboarding

The six-step application at `/driver/apply` registers a new driver through the existing public `POST /users` endpoint. It sends a `CreateUserDto` with `role: "Driver"` and a nested `driver_details: DriverRegistrationDto`. It does not create a separate car or call an admin-only user endpoint.

All document and photo fields contain **raw Base64 file contents**, without a `data:...;base64,` prefix. Selected PDF, JPG and PNG files are read in the browser, limited to 8 MB each, and retained only in the in-memory application draft until submission. Files are sent with the registration JSON; there is no separate upload request. Successful submission clears the draft. Passwords are kept only in the final form and are never stored in the application store or browser storage.

The payload maps licence classes to `B`, `C`, `D` or `E`, uses `YYYY-MM-DD` for licence expiry, and sends vehicle year and passenger seats as integers. Selecting both driving tracks sends `Both`; the individual selections send `Volunteer` or `Professional`. Empty city and vehicle photo values are sent as `null`. Worker applications clear guarantor fields; non-worker applications clear the department and include the guarantor details and photo.

Each step validates its fields, and submission revalidates the complete draft. API failures keep the draft available for correction and retry. Account creation is never automatically retried, and the UI prevents duplicate submissions. Success directs the applicant to sign in; registration itself does not authenticate the new account. Explicit demo mode keeps submission local.

The API user type includes nullable `driver_profile` and `car` fields. `src/types/driver-api.ts` defines the registration, profile and public driver-view DTOs. The supplied schemas are reflected in the repository and public OpenAPI copies. Public ride projections retain vehicle capacity and handle nullable profile values.

Run `node --experimental-strip-types --test tests/driver-registration.test.mjs` for payload, file encoding, validation, transport and response coverage. Transport tests mock requests and do not create real accounts.
