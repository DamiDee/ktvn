export type BusDirection = "TO_SERVICE" | "FROM_SERVICE";
export type ChurchService = "KOINONIA" | "TGA";

export interface BusServiceEvent {
  id: string;
  service: ChurchService;
  date: string;
  venue: string;
  venueMeetingPoint: string;
}

export interface FreeBus {
  id: string;
  label: string;
  model: string;
  capacity: number;
  departedAt?: string;
}

export interface BusAllocation {
  id: string;
  eventId: string;
  direction: BusDirection;
  /** The pickup point on an outbound leg; the drop-off point on a return leg. */
  communityPoint: string;
  landmark: string;
  boardingAt: string;
  buses: FreeBus[];
}

export interface BusBooking {
  id: string;
  reference: string;
  allocationId: string;
  busId: string;
  memberId: string;
  memberName: string;
  seatNumber: number;
  bookedAt: string;
  cancelledAt?: string;
}

export interface BusNotice {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  allocationId: string;
}

export interface FreeBusState {
  events: BusServiceEvent[];
  allocations: BusAllocation[];
  bookings: BusBooking[];
  notices: BusNotice[];
}

export interface ScheduleBusesInput {
  eventId?: string;
  service: ChurchService;
  date: string;
  venue: string;
  venueMeetingPoint: string;
  direction: BusDirection;
  communityPoint: string;
  landmark: string;
  boardingAt: string;
  busCount: number;
  capacity: number;
  model: string;
}

export interface BusActor {
  id: string;
  name: string;
  role: "PASSENGER" | "ADMIN" | "DRIVER";
}
