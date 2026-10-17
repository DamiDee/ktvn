import { z } from "zod";
import { DocumentType } from "../../types/enums.ts";
import type { DriverTrack } from "../../types/enums.ts";
import type { CreateUserDto } from "../../types/driver-api.ts";
import type { VerificationDocument } from "../../types/models.ts";
import { MAX_APPLICATION_BYTES, MAX_DOCUMENT_BYTES, formatMegabytes } from "../../lib/document-file.ts";
import {
  accountCredentialsSchema,
  identitySchema,
  licenceSchema,
  trackSchema,
  vehicleSchema,
  type IdentityValues,
  type LicenceValues,
  type VehicleValues,
} from "./application-schemas.ts";

export const documentContentSchema = z.string().min(1, "Choose a document file")
  .max(Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4, `The file limit is ${formatMegabytes(MAX_DOCUMENT_BYTES)}`)
  .regex(/^[A-Za-z0-9+/]*={0,2}$/, "Choose a valid document file")
  .refine((value) => value.length % 4 === 0, "Choose a valid document file");

export interface DriverApplicationDraft {
  identity: Partial<IdentityValues>;
  licence: Partial<LicenceValues>;
  vehicle: Partial<VehicleValues>;
  tracks: DriverTrack[];
  documents: Partial<Record<DocumentType, VerificationDocument>>;
}

export class DriverApplicationError extends Error {
  stepIndex: number;

  constructor(message: string, stepIndex: number) {
    super(message);
    this.name = "DriverApplicationError";
    this.stepIndex = stepIndex;
  }
}

/** Validate the entire draft again: editing earlier steps can invalidate later ones. */
export function buildDriverRegistration(draft: DriverApplicationDraft, credentials: unknown): CreateUserDto {
  const identity = identitySchema.safeParse(draft.identity);
  if (!identity.success) throw new DriverApplicationError(identity.error.issues[0].message, 0);
  const licence = licenceSchema.safeParse(draft.licence);
  if (!licence.success) throw new DriverApplicationError(licence.error.issues[0].message, 1);
  const vehicle = vehicleSchema.safeParse(draft.vehicle);
  if (!vehicle.success) throw new DriverApplicationError(vehicle.error.issues[0].message, 2);
  const tracks = trackSchema.safeParse({ tracks: draft.tracks });
  if (!tracks.success) throw new DriverApplicationError(tracks.error.issues[0].message, 4);
  const account = accountCredentialsSchema.safeParse(credentials);
  if (!account.success) throw new DriverApplicationError(account.error.issues[0].message, 5);

  function contents(type: DocumentType, label: string, step: number): string {
    const doc = draft.documents[type];
    const parsed = documentContentSchema.safeParse(doc?.base64);
    if (!parsed.success) throw new DriverApplicationError(`Upload ${label} before submitting.`, step);
    return parsed.data;
  }

  const person = identity.data;
  const isWorker = person.workerStatus === "YES";
  const [first_name, ...last] = person.fullName.trim().split(/\s+/);
  const payload: CreateUserDto = {
    first_name,
    last_name: last.join(" "),
    email: person.email.trim(),
    username: person.username,
    phone: person.phone.trim(),
    address: person.address,
    city: person.city.trim(),
    country: person.country,
    password: account.data.password,
    role: "Driver",
    driver_details: {
      nin: person.nin,
      nin_slip: contents(DocumentType.GOVERNMENT_ID, "your NIN slip", 0),
      profile_photo: contents(DocumentType.PROFILE_PHOTO, "your profile photo", 0),
      is_koinonia_worker: isWorker,
      koinonia_department: isWorker ? person.department!.trim() : null,
      guarantor_name: isWorker ? null : person.guarantorName!.trim(),
      guarantor_phone: isWorker ? null : person.guarantorPhone!.trim(),
      guarantor_relationship: isWorker ? null : person.guarantorRelationship!.trim(),
      guarantor_photo: isWorker ? null : contents(DocumentType.GUARANTOR_PHOTO, "your guarantor photo", 0),
      licence_number: licence.data.licenceNumber.trim(),
      licence_class: licence.data.licenceClass,
      licence_expiry_date: licence.data.licenceExpiry,
      licence_photo: contents(DocumentType.DRIVERS_LICENCE, "your driver's licence", 1),
      vehicle_make: vehicle.data.make.trim(),
      vehicle_model: vehicle.data.model.trim(),
      vehicle_colour: vehicle.data.colour.trim(),
      vehicle_year: Number(vehicle.data.year),
      vehicle_plate_number: vehicle.data.plateNumber.toUpperCase(),
      passenger_seats: Number(vehicle.data.seats),
      vehicle_photo: contents(DocumentType.VEHICLE_PHOTO, "your vehicle photo", 2),
      vehicle_registration: contents(DocumentType.VEHICLE_REGISTRATION, "your vehicle registration", 3),
      insurance_certificate: contents(DocumentType.INSURANCE, "your insurance certificate", 3),
      roadworthiness_certificate: contents(DocumentType.ROADWORTHINESS, "your roadworthiness certificate", 3),
      track: new Set(tracks.data.tracks).size === 2 ? "Both" : tracks.data.tracks[0] === "VOLUNTEER" ? "Volunteer" : "Professional",
    },
  };

  // Everything travels in one JSON body. Refuse here, with a useful message,
  // rather than let the API answer 413 (which the browser reports as a
  // network failure with no readable reason).
  const bodyBytes = new TextEncoder().encode(JSON.stringify(payload)).length;
  if (bodyBytes > MAX_APPLICATION_BYTES) {
    throw new DriverApplicationError(
      `Your documents add up to ${formatMegabytes(bodyBytes)}, over the ${formatMegabytes(MAX_APPLICATION_BYTES)} limit. Replace any PDFs with photos of the documents, then submit again.`,
      3,
    );
  }

  return payload;
}
