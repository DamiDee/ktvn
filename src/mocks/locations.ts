import type { RideLocation } from "@/types/models";

/**
 * Abuja locations used across mock rides. Coordinates are approximate and
 * exist only to give the map simulation realistic relative geometry.
 */

export const LOCATIONS = {
  koinoniaCentre: {
    id: "loc-koinonia-centre",
    label: "Koinonia Centre",
    address: "Koinonia Global, Lugbe, Abuja",
    area: "Lugbe",
    lat: 8.9925,
    lng: 7.3805,
  },
  gwarinpa: {
    id: "loc-gwarinpa",
    label: "Gwarinpa",
    address: "3rd Avenue, Gwarinpa Estate, Abuja",
    area: "Gwarinpa",
    lat: 9.1082,
    lng: 7.4013,
  },
  lifeCamp: {
    id: "loc-life-camp",
    label: "Life Camp",
    address: "Life Camp Junction, Abuja",
    area: "Life Camp",
    lat: 9.0862,
    lng: 7.4238,
  },
  wuseII: {
    id: "loc-wuse-ii",
    label: "Wuse II",
    address: "Aminu Kano Crescent, Wuse II, Abuja",
    area: "Wuse II",
    lat: 9.0765,
    lng: 7.4712,
  },
  garki: {
    id: "loc-garki",
    label: "Garki",
    address: "Area 11, Garki, Abuja",
    area: "Garki",
    lat: 9.0333,
    lng: 7.4899,
  },
  maitama: {
    id: "loc-maitama",
    label: "Maitama",
    address: "Gana Street, Maitama, Abuja",
    area: "Maitama",
    lat: 9.0873,
    lng: 7.4951,
  },
  jabi: {
    id: "loc-jabi",
    label: "Jabi",
    address: "Jabi Lake District, Abuja",
    area: "Jabi",
    lat: 9.0645,
    lng: 7.4262,
  },
  kubwa: {
    id: "loc-kubwa",
    label: "Kubwa",
    address: "Phase 4, Kubwa, Abuja",
    area: "Kubwa",
    lat: 9.1548,
    lng: 7.3268,
  },
  asokoro: {
    id: "loc-asokoro",
    label: "Asokoro",
    address: "Yakubu Gowon Crescent, Asokoro, Abuja",
    area: "Asokoro",
    lat: 9.0389,
    lng: 7.5217,
  },
  lugbe: {
    id: "loc-lugbe",
    label: "Lugbe",
    address: "FHA Lugbe, Abuja",
    area: "Lugbe",
    lat: 8.9788,
    lng: 7.3702,
  },
} as const satisfies Record<string, RideLocation>;

export const ALL_LOCATIONS: RideLocation[] = Object.values(LOCATIONS);

/** Shown when the destination search field is focused but empty. */
export const RECENT_DESTINATIONS: RideLocation[] = [
  LOCATIONS.gwarinpa,
  LOCATIONS.lifeCamp,
  LOCATIONS.wuseII,
];

export const SUGGESTED_DESTINATIONS: RideLocation[] = [
  LOCATIONS.jabi,
  LOCATIONS.garki,
  LOCATIONS.maitama,
  LOCATIONS.kubwa,
];

export function searchLocations(query: string): RideLocation[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  return ALL_LOCATIONS.filter(
    (location) =>
      location.label.toLowerCase().includes(trimmed) ||
      location.address.toLowerCase().includes(trimmed) ||
      location.area?.toLowerCase().includes(trimmed),
  );
}
