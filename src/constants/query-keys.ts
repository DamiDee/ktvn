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
    overview: (period?: string) => [...queryKeys.admin.root, "overview", period ?? "default"] as const,
    sos: () => [...queryKeys.admin.root, "sos"] as const,
    liveRides: (filter?: string, q?: string) => [...queryKeys.admin.root, "live-rides", filter ?? "ALL", q ?? ""] as const,
    liveRide: (id: string) => [...queryKeys.admin.root, "live-ride", id] as const,
    verifications: (filter?: string, q?: string) => [...queryKeys.admin.root, "verifications", filter ?? "ALL", q ?? ""] as const,
    verification: (id: string) =>
      [...queryKeys.admin.root, "verification", id] as const,
    drivers: (filter?: string, q?: string) => [...queryKeys.admin.root, "drivers", filter ?? "ALL", q ?? ""] as const,
    driver: (id: string) => [...queryKeys.admin.root, "driver", id] as const,
    passengers: (filter?: string, q?: string) => [...queryKeys.admin.root, "passengers", filter ?? "ALL", q ?? ""] as const,
    passenger: (id: string) => [...queryKeys.admin.root, "passenger", id] as const,
    incidents: (filter?: string, q?: string) =>
      [...queryKeys.admin.root, "incidents", filter ?? "ALL", q ?? ""] as const,
    incident: (id: string) => [...queryKeys.admin.root, "incident", id] as const,
    quality: () => [...queryKeys.admin.root, "quality"] as const,
    reports: (period?: string) => [...queryKeys.admin.root, "reports", period ?? "MONTH"] as const,
  },

  notifications: ["notifications"] as const,
  locations: {
    all: ["locations"] as const,
    search: (query: string) => ["locations", "search", query] as const,
  },
  estimate: (pickupId: string, destinationId: string, track: string, type: string) =>
    ["estimate", pickupId, destinationId, track, type] as const,
} as const;
