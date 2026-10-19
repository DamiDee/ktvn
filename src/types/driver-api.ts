import type { ApiRole } from "./freebus-api";

export type LicenceClass = "B" | "C" | "D" | "E";
export type DriverTrack = "Volunteer" | "Professional" | "Both";

export interface DriverRegistrationDto {
  account_number: string;
  guarantor_name?: string | null;
  guarantor_phone?: string | null;
  guarantor_photo?: string | null;
  guarantor_relationship?: string | null;
  insurance_certificate: string;
  is_koinonia_worker: boolean;
  koinonia_department?: string | null;
  licence_class: LicenceClass;
  licence_expiry_date: string;
  licence_number: string;
  licence_photo: string;
  nin: string;
  nin_slip: string;
  passenger_seats: number;
  profile_photo: string;
  roadworthiness_certificate: string;
  track: DriverTrack;
  vehicle_colour: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_photo?: string | null;
  vehicle_plate_number: string;
  vehicle_registration: string;
  vehicle_year: number;
}

export interface CreateUserDto {
  address: string;
  city?: string | null;
  country: string;
  driver_details?: DriverRegistrationDto | null;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  phone: string;
  role?: ApiRole | null;
  username: string;
}

export interface DriverProfileDto {
  car_id: string;
  created_at: string;
  guarantor_name?: string | null;
  guarantor_phone?: string | null;
  guarantor_photo?: string | null;
  guarantor_relationship?: string | null;
  id: string;
  is_koinonia_worker: boolean;
  koinonia_department?: string | null;
  licence_class: string;
  licence_expiry_date: string;
  licence_number: string;
  licence_photo: string;
  nin_slip: string;
  profile_photo: string;
  status: string;
  track: string;
  updated_at: string;
  user_id: string;
}

export type DriverProfile = DriverProfileDto;

export interface VehicleView {
  capacity: number;
  color: string;
  colorHex?: string | null;
  make: string;
  model: string;
  plate: string;
  vehicleClass: string;
}

export interface DriverView {
  avatarUrl?: string | null;
  completedRides: number;
  contact: {
    call: string;
    callHref?: string | null;
    chat: boolean;
  };
  displayName: string;
  rating?: number | null;
  vehicle?: VehicleView | null;
  verified: boolean;
}
