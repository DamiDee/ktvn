import type { PickupZone } from "@/types/models";

/**
 * Stewarded pickup points around Koinonia Centre. The coordinates are
 * intentionally close together so the map can show a realistic meeting-zone
 * change without pretending to provide turn-by-turn walking directions.
 */
export const PICKUP_ZONES: PickupZone[] = [
  {
    id: "pickup-gate-b",
    code: "B",
    label: "Gate B pickup",
    landmark: "Family entrance · beside the blue canopy",
    walkingMinutes: 3,
    recommended: true,
    accessible: true,
    location: {
      id: "loc-koinonia-gate-b",
      label: "Gate B · Koinonia Centre",
      address: "Family entrance, Koinonia Global, Lugbe, Abuja",
      area: "Lugbe",
      lat: 8.9931,
      lng: 7.3812,
    },
  },
  {
    id: "pickup-north-park",
    code: "N",
    label: "North car park",
    landmark: "Row 4 · under the green pickup sign",
    walkingMinutes: 6,
    location: {
      id: "loc-koinonia-north-park",
      label: "North car park · Koinonia Centre",
      address: "North parking area, Koinonia Global, Lugbe, Abuja",
      area: "Lugbe",
      lat: 8.9942,
      lng: 7.3798,
    },
  },
  {
    id: "pickup-accessible",
    code: "A",
    label: "Accessible pickup",
    landmark: "Main foyer · steward-assisted meeting point",
    walkingMinutes: 2,
    accessible: true,
    location: {
      id: "loc-koinonia-accessible",
      label: "Accessible pickup · Koinonia Centre",
      address: "Main foyer, Koinonia Global, Lugbe, Abuja",
      area: "Lugbe",
      lat: 8.9927,
      lng: 7.3808,
    },
  },
];

export const DEFAULT_PICKUP_ZONE = PICKUP_ZONES[0];
