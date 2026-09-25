export type ApiRole = "Root" | "Admin" | "RouteCoordinator" | "User" | "Driver";
export type ApiRideType = "Pickup" | "Dropoff" | "RoundTrip";
export type ApiBusState = "Transit" | "Arrived" | "Stationary" | "Boarding";
export interface ApiUser {
  id: string; first_name: string; last_name: string; email: string; username: string;
  phone: string; address: string; country: string; role: ApiRole; is_active: boolean;
  is_identity_verified: boolean; created_at: string;
  identity_type?: string | null;
  identity_number?: string | null;
  updated_at?: string;
  last_seen?: string;
}
export interface ApiPoint {
  id: string; name: string; landmark: string; description: string;
  geo_location: { lat: string; long: string };
}
export interface ApiRoute {
  id: string; name: string; description: string; start_point: string; end_point: string;
  fare: number; distance: number; ride_type: ApiRideType; stops: string[];
  departure_date: string; departure_time: string; is_completed: boolean;
}
export interface ApiBus {
  id: string; license_plate: string; capacity: number; current_passenger_count: number;
  current_route_id: string | null; state: ApiBusState;
  status: "Available" | "Maintenance" | "InUse";
}
export interface ApiBooking {
  qr_code?: string | null;
  id: string; booking_ref: string; user_id: string; bus_id: string; route_id: string;
  seat_number: number; status: "Boarded" | "Confirmed" | "Cancelled" | "Revoked";
  payment_status: "Free" | "Pending" | "Paid" | "Failed" | "Refunded";
  created_at: string;
}
export interface ApiSeats {
  bus_id: string; capacity: number; current_passenger_count: number;
  booked_seats: number[]; available_seats: number[];
}
export interface ApiRegistration {
  first_name: string; last_name: string; email: string; username: string;
  phone: string; address: string; country: string; password: string;
}
