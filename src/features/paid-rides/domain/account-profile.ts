import { RideServiceError } from "./errors.ts";
import type { AccountDocument, RideAccountProfile, Vehicle, Viewer } from "./types.ts";

type Json = Record<string, unknown>;
const object = (value: unknown): Json => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
const string = (value: unknown): string => typeof value === "string" ? value.trim() : "";
export const unwrapAccountResponse = (value: unknown): Json => {
  const raw = object(value);
  return Object.hasOwn(raw, "data") ? object(raw.data) : raw;
};

/** The user DTO returns raw Base64. Only supported file formats become preview URLs. */
export function accountDocumentSource(value: unknown): string | undefined {
  const raw = string(value);
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw) || /^\/(?![\/\d])/.test(raw)) return raw;
  if (/^data:(?:image\/(?:jpeg|png|webp|gif)|application\/pdf);base64,[A-Za-z0-9+/]+={0,2}$/i.test(raw)) return raw;
  const base64 = raw.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) return undefined;
  const mime = base64.startsWith("/9j/") ? "image/jpeg" : base64.startsWith("iVBORw0KGgo") ? "image/png" : base64.startsWith("JVBERi0") ? "application/pdf" : undefined;
  return mime ? `data:${mime};base64,${base64}` : undefined;
}

function document(label: string, value: unknown): AccountDocument {
  return { label, provided: Boolean(string(value)), source: accountDocumentSource(value) };
}

export function mapAccountVehicle(value: unknown): Vehicle | undefined {
  const car = unwrapAccountResponse(value);
  if (!string(car.id)) return undefined;
  const type = string(car.car_type).toLowerCase();
  const premium = ["premium", "luxury"].includes(string(car.car_tier).toLowerCase());
  return {
    make: string(car.brand), model: string(car.model), color: string(car.color),
    colorHex: string(car.color_hex) || undefined, plate: string(car.license_plate),
    vehicleClass: type === "suv" ? "suv" : type === "van" ? "van" : premium ? "premium" : "sedan",
    capacity: Number.isInteger(car.capacity) ? Number(car.capacity) : undefined,
    year: Number.isInteger(car.year) ? Number(car.year) : undefined,
    verified: car.is_verified === true,
  };
}

export function mapAccountViewer(value: unknown, carValue?: unknown, vehicleLoadFailed = false): Viewer {
  const user = unwrapAccountResponse(value);
  const id = string(user.id);
  if (!id || !string(user.role) || user.is_active !== true) throw new RideServiceError(user.is_active === false ? "forbidden" : "unavailable");
  const profile = object(user.driver_profile);
  const driver = user.role === "Driver";
  const hasProfile = driver && Boolean(string(profile.id));
  if (hasProfile && string(profile.user_id) && profile.user_id !== id) throw new RideServiceError("unavailable");
  const identity = string(user.identity_number);
  const photo = hasProfile ? accountDocumentSource(profile.profile_photo) : undefined;
  const account: RideAccountProfile = {
    id, firstName: string(user.first_name), lastName: string(user.last_name), username: string(user.username),
    email: string(user.email), phone: string(user.phone), address: string(user.address), city: string(user.city) || undefined,
    country: string(user.country), joinedAt: string(user.created_at), identityVerified: user.is_identity_verified === true,
    maskedNin: identity && user.identity_type === "NIN" ? `•••••••${identity.slice(-4)}` : undefined,
    vehicleId: driver ? string(profile.car_id) || string(user.car) || undefined : undefined,
    vehicleLoadFailed,
    documents: hasProfile ? [document("NIN slip", profile.nin_slip), document("Driver's licence", profile.licence_photo), document("Profile photo", profile.profile_photo)] : [],
    driver: hasProfile ? {
      status: string(profile.status) || "Unknown", track: string(profile.track), licenceNumber: string(profile.licence_number),
      licenceClass: string(profile.licence_class), licenceExpiryDate: string(profile.licence_expiry_date),
      isKoinoniaWorker: profile.is_koinonia_worker === true,
      department: profile.is_koinonia_worker === true ? string(profile.koinonia_department) || undefined : undefined,
      guarantorName: profile.is_koinonia_worker !== true ? string(profile.guarantor_name) || undefined : undefined,
      guarantorPhone: profile.is_koinonia_worker !== true ? string(profile.guarantor_phone) || undefined : undefined,
      guarantorRelationship: profile.is_koinonia_worker !== true ? string(profile.guarantor_relationship) || undefined : undefined,
    } : undefined,
  };
  const vehicle = driver ? mapAccountVehicle(carValue) : undefined;
  const car = unwrapAccountResponse(carValue);
  if (hasProfile && car.id) {
    account.documents.push(document("Vehicle registration", car.vehicle_registration), document("Insurance certificate", car.insurance_certificate), document("Roadworthiness certificate", car.roadworthiness_certificate));
    if (string(car.vehicle_photo)) account.documents.push(document("Vehicle photo", car.vehicle_photo));
  }
  if (hasProfile && profile.is_koinonia_worker !== true && string(profile.guarantor_photo)) account.documents.push(document("Guarantor photo", profile.guarantor_photo));
  return {
    displayName: [account.firstName, account.lastName].filter(Boolean).join(" ") || account.username || "Your account",
    avatarUrl: photo && !photo.startsWith("data:application/pdf") ? photo : undefined,
    roles: driver ? ["passenger", "driver"] : ["passenger"], vehicle, account,
  };
}

export function driverOnlineEligibility(viewer: Viewer | undefined): { allowed: boolean; message?: string } {
  if (!viewer) return { allowed: false, message: "Your account is loading." };
  if (!viewer.account) return { allowed: true }; // The explicit simulation has no live account.
  const profile = viewer.account.driver;
  if (!profile) return { allowed: false, message: "Your driver profile needs to be completed before you can go online." };
  if (!["approved", "verified", "active"].includes(profile.status.toLowerCase())) return {
    allowed: false,
    message: ["pending", "submitted", "underreview", "inreview"].includes(profile.status.toLowerCase().replace(/[ _-]/g, ""))
      ? "Your driver application is under review. You can go online once your account and vehicle are approved."
      : `Driver verification: ${profile.status}. Your account needs approval before you can go online.`,
  };
  if (viewer.account.vehicleLoadFailed) return { allowed: false, message: "We couldn't load your vehicle. Refresh your account before going online." };
  if (!viewer.vehicle || !viewer.vehicle.verified) return { allowed: false, message: "Your linked vehicle needs approval before you can go online." };
  return { allowed: true };
}
