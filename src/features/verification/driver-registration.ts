import { z } from "zod";
import { DocumentType } from "../../types/enums.ts";
import type { DriverTrack } from "../../types/enums.ts";
import type { CreateUserDto } from "../../types/driver-api.ts";
import type { VerificationDocument } from "../../types/models.ts";
import { MAX_DOCUMENT_BYTES, compressDocumentContent, formatMegabytes, getApplicationSizeError } from "../../lib/document-file.ts";
import { fitRegistration, type ApplicationOptimizationProgress } from "./fit-registration.ts";
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
  .refine((value) => value.length % 4 === 0, "Choose a valid document file")
  .refine((value) => value.length / 4 * 3 - (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0) <= MAX_DOCUMENT_BYTES,
    `The file limit is ${formatMegabytes(MAX_DOCUMENT_BYTES)}`);

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
  return assembleDriverRegistration(draft, credentials, true);
}

function assembleDriverRegistration(draft: DriverApplicationDraft, credentials: unknown, enforceSize: boolean): CreateUserDto {
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
      account_number: person.accountNumber.trim(),
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

  const sizeError = getApplicationSizeError(JSON.stringify(payload));
  if (enforceSize && sizeError) throw new DriverApplicationError(sizeError, 3);

  return payload;
}

const DOCUMENT_FIELDS = [
  [DocumentType.GOVERNMENT_ID, "nin_slip"], [DocumentType.PROFILE_PHOTO, "profile_photo"],
  [DocumentType.DRIVERS_LICENCE, "licence_photo"], [DocumentType.VEHICLE_PHOTO, "vehicle_photo"],
  [DocumentType.VEHICLE_REGISTRATION, "vehicle_registration"], [DocumentType.INSURANCE, "insurance_certificate"],
  [DocumentType.ROADWORTHINESS, "roadworthiness_certificate"], [DocumentType.GUARANTOR_PHOTO, "guarantor_photo"],
] as const;

/** Build, automatically shrink, then revalidate the actual DTO before networking. */
export async function prepareDriverRegistration(draft: DriverApplicationDraft, credentials: unknown, options: {
  signal?: AbortSignal;
  onProgress?: (progress: ApplicationOptimizationProgress) => void;
} = {}) {
  const payload = assembleDriverRegistration(draft, credentials, false);
  const documents = DOCUMENT_FIELDS.filter(([, field]) => payload.driver_details![field]).map(([type, field]) => {
    const doc = draft.documents[type]!;
    const content = payload.driver_details![field]!;
    // MIME metadata is retained for new selections; recognize older in-memory drafts too.
    const mimeType = doc.mimeType ?? (content.startsWith("JVBER") ? "application/pdf" : content.startsWith("iVBOR") ? "image/png" : "image/jpeg");
    return { field, label: doc.label, mimeType, originalSizeBytes: doc.originalSizeBytes ?? doc.sizeBytes ?? 0 };
  });
  try {
    let latest: ApplicationOptimizationProgress = { totalBytes: 0, originalBytes: 0 };
    const result = await fitRegistration(payload, documents, (content, mimeType, targetBytes, label) =>
      compressDocumentContent(content, mimeType, targetBytes, {
        signal: options.signal,
        onProgress: (progress) => options.onProgress?.({ ...latest, label, page: progress.page, pages: progress.pages }),
      }), { ...options, onProgress: (progress) => { latest = progress; options.onProgress?.(progress); } });
    const updated = { ...draft.documents };
    for (const [type, field] of DOCUMENT_FIELDS) {
      const encoded = result.prepared.get(field);
      const doc = updated[type];
      if (encoded && doc) updated[type] = { ...doc, ...encoded, fileType: encoded.mimeType === "application/pdf" ? "PDF" : "JPG" };
    }
    // This enforces all field/per-file/aggregate checks after transformations.
    const validated = buildDriverRegistration({ ...draft, documents: updated }, credentials);
    return { ...result, payload: validated, documents: updated };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new DriverApplicationError(error instanceof Error ? error.message : "We couldn't prepare your application. Contact support for help.", 3);
  }
}
