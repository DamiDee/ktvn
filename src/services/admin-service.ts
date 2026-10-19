import {
  ACTIVE_SOS,
  ADMIN_METRICS,
  ADMIN_SECONDARY_METRICS,
  INCIDENTS,
  LIVE_DRIVERS,
  LIVE_RIDES,
  QUALITY_FLAGS,
  REPORT_SECTIONS,
  RIDE_VOLUME_SERIES,
  TRACK_DISTRIBUTION,
} from "@/mocks/admin";
import type { LiveDriversSnapshot } from "@/features/admin/data/admin-wire";
import { IncidentStatus } from "@/types/enums";
import type {
  AdminMetric,
  Incident,
  LiveRideSummary,
  QualityFlag,
  ReportSection,
  SOSAlert,
} from "@/types/models";
import { MockDelay, request, type RequestOptions } from "./api-client";

export interface AdminOverview {
  primary: AdminMetric[];
  secondary: AdminMetric[];
  trackDistribution: typeof TRACK_DISTRIBUTION;
  rideVolume: typeof RIDE_VOLUME_SERIES;
  activeSos: SOSAlert | null;
}

export const adminService = {
  async getOverview(options?: RequestOptions): Promise<AdminOverview> {
    return request(
      () => ({
        primary: ADMIN_METRICS,
        secondary: ADMIN_SECONDARY_METRICS,
        trackDistribution: TRACK_DISTRIBUTION,
        rideVolume: RIDE_VOLUME_SERIES,
        activeSos: ACTIVE_SOS,
      }),
      { delayMs: MockDelay.normal, ...options },
    );
  },

  async listLiveRides(options?: RequestOptions): Promise<LiveRideSummary[]> {
    return request(() => LIVE_RIDES, { delayMs: MockDelay.normal, ...options });
  },

  async getLiveRide(
    id: string,
    options?: RequestOptions,
  ): Promise<LiveRideSummary | null> {
    return request(() => LIVE_RIDES.find((ride) => ride.id === id) ?? null, {
      delayMs: MockDelay.fast,
      ...options,
    });
  },

  async listIncidents(
    status?: IncidentStatus,
    options?: RequestOptions,
  ): Promise<Incident[]> {
    return request(
      () =>
        status
          ? INCIDENTS.filter((incident) => incident.status === status)
          : INCIDENTS,
      { delayMs: MockDelay.normal, ...options },
    );
  },

  async getIncident(
    id: string,
    options?: RequestOptions,
  ): Promise<Incident | null> {
    return request(
      () => INCIDENTS.find((incident) => incident.id === id) ?? null,
      { delayMs: MockDelay.fast, ...options },
    );
  },

  async listQualityFlags(options?: RequestOptions): Promise<QualityFlag[]> {
    return request(() => QUALITY_FLAGS, {
      delayMs: MockDelay.normal,
      ...options,
    });
  },

  async listReports(options?: RequestOptions): Promise<ReportSection[]> {
    return request(() => REPORT_SECTIONS, {
      delayMs: MockDelay.normal,
      ...options,
    });
  },

  /** The live driver map. Moving drivers drift along their heading between polls. */
  async listLiveDrivers(options?: RequestOptions): Promise<LiveDriversSnapshot> {
    return request(
      () => {
        const now = Date.now();
        const elapsed = (now % 600_000) / 1_000;
        const items = LIVE_DRIVERS.map(({ secondsAgo, ...driver }) => {
          const metres = driver.heading !== null && driver.speedMps ? (driver.speedMps * elapsed) % 1_500 : 0;
          const radians = ((driver.heading ?? 0) * Math.PI) / 180;
          return {
            ...driver,
            lat: driver.lat + (metres * Math.cos(radians)) / 111_320,
            lng: driver.lng + (metres * Math.sin(radians)) / (111_320 * Math.cos((driver.lat * Math.PI) / 180)),
            lastSeenAt: new Date(now - secondsAgo * 1_000).toISOString(),
          };
        });
        return { items, total: items.length };
      },
      { delayMs: MockDelay.fast, ...options },
    );
  },

  async acknowledgeSos(options?: RequestOptions): Promise<SOSAlert> {
    return request(() => ACTIVE_SOS, { delayMs: MockDelay.fast, ...options });
  },
};
