/** Centralised TanStack Query keys so cache invalidation stays predictable. */
export const queryKeys = {
  session: ["session"] as const,

  passenger: {
    root: ["passenger"] as const,
    profile: () => [...queryKeys.passenger.root, "profile"] as const,
    rides: () => [...queryKeys.passenger.root, "rides"] as const,
    ride: (id: string) => [...queryKeys.passenger.root, "ride", id] as const,
    event: () => [...queryKeys.passenger.root, "event"] as const,
  },

  driver: {
    root: ["driver"] as const,
    profile: (driverId?: string) =>
      [...queryKeys.driver.root, "profile", driverId ?? "current"] as const,
    requests: (track: string) =>
      [...queryKeys.driver.root, "requests", track] as const,
    verification: () => [...queryKeys.driver.root, "verification"] as const,
    activeTrip: (track: string) =>
      [...queryKeys.driver.root, "active-trip", track] as const,
  },

  admin: {
    root: ["admin"] as const,
    overview: () => [...queryKeys.admin.root, "overview"] as const,
    liveRides: () => [...queryKeys.admin.root, "live-rides"] as const,
    liveRide: (id: string) => [...queryKeys.admin.root, "live-ride", id] as const,
    verifications: () => [...queryKeys.admin.root, "verifications"] as const,
    verification: (id: string) =>
      [...queryKeys.admin.root, "verification", id] as const,
    drivers: () => [...queryKeys.admin.root, "drivers"] as const,
    driver: (id: string) => [...queryKeys.admin.root, "driver", id] as const,
    passengers: () => [...queryKeys.admin.root, "passengers"] as const,
    passenger: (id: string) => [...queryKeys.admin.root, "passenger", id] as const,
    incidents: (status?: string) =>
      [...queryKeys.admin.root, "incidents", status ?? "all"] as const,
    incident: (id: string) => [...queryKeys.admin.root, "incident", id] as const,
    quality: () => [...queryKeys.admin.root, "quality"] as const,
    reports: () => [...queryKeys.admin.root, "reports"] as const,
  },

  notifications: ["notifications"] as const,
  locations: {
    all: ["locations"] as const,
    search: (query: string) => ["locations", "search", query] as const,
  },
  estimate: (pickupId: string, destinationId: string, track: string, type: string) =>
    ["estimate", pickupId, destinationId, track, type] as const,
} as const;
