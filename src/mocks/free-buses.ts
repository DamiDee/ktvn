import type { BusAllocation, FreeBusState } from "../types/free-buses";

/** Illustrative service venues/meeting points; admin-created schedules supply the real details. */
export function createFreeBusSeed(now = new Date()): FreeBusState {
  const sunday = new Date(now);
  sunday.setUTCDate(sunday.getUTCDate() + ((7 - sunday.getUTCDay()) % 7 || 7));
  const date = sunday.toISOString().slice(0, 10);
  const state: FreeBusState = {
    events: [
      { id: "sunday-demo", service: "KOINONIA", date, venue: "Koinonia Centre · Abuja", venueMeetingPoint: "Transportation desk, main car park" },
      { id: "tga-demo", service: "TGA", date, venue: "T.G.A service venue · Abuja", venueMeetingPoint: "T.G.A transportation desk, bus bay" },
    ],
    allocations: [], bookings: [], notices: [],
  };
  function route(id: string, eventId: string, direction: BusAllocation["direction"], point: string, landmark: string, count: number, initialSeats = 0) {
    const allocation: BusAllocation = {
      id, eventId, direction, communityPoint: point, landmark,
      boardingAt: `${date}T${direction === "TO_SERVICE" ? "14:00" : "21:30"}:00+01:00`,
      buses: Array.from({ length: count }, (_, i) => ({
        id: `${id}-bus-${i + 1}`, label: `Bus ${String(i + 1).padStart(2, "0")}`, model: "Toyota Hiace", capacity: 18,
      })),
    };
    state.allocations.push(allocation);
    for (let i = 0; i < initialSeats; i += 1) {
      const bus = allocation.buses[Math.floor(i / 18)];
      state.bookings.push({
        id: `${id}-seed-${i}`, reference: `FB-DEMO-${i + 1}`, allocationId: id,
        busId: bus.id, memberId: `${id}-member-${i}`, memberName: `Member ${i + 1}`,
        seatNumber: i % 18 + 1, bookedAt: now.toISOString(),
      });
      if (i % 18 === 17) bus.departedAt = now.toISOString();
    }
  }
  route("lugbe-out", "sunday-demo", "TO_SERVICE", "Lugbe Police Signpost", "Meet beside the signpost, at the K-Rides steward point", 3, 17);
  route("gwarinpa-out", "sunday-demo", "TO_SERVICE", "Gwarinpa 1st Avenue", "Main junction, beside the transport stewards", 2, 6);
  route("nyanya-out", "sunday-demo", "TO_SERVICE", "Nyanya Motor Park", "Church transport stand", 1, 18);
  route("lugbe-return", "sunday-demo", "FROM_SERVICE", "Lugbe Federal Housing Junction", "Drop-off at the FHA junction", 3, 4);
  route("kubwa-return", "sunday-demo", "FROM_SERVICE", "Kubwa Express Junction", "Drop-off beside the main junction", 2);
  route("tga-lugbe-out", "tga-demo", "TO_SERVICE", "Lugbe Police Signpost", "Meet the T.G.A transport stewards beside the signpost", 2, 10);
  route("tga-mararaba-out", "tga-demo", "TO_SERVICE", "Mararaba Junction", "Designated church transport stand", 2);
  route("tga-lugbe-return", "tga-demo", "FROM_SERVICE", "Lugbe Federal Housing Junction", "Drop-off at the FHA junction", 2);
  return state;
}
