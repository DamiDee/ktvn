import type { GeoPoint, RouteGeometry, VehicleClass } from "../domain/types";

export interface MapVehicle {
  point: GeoPoint;
  heading: number | null;
  vehicleClass: VehicleClass;
  paint?: string;
}

export interface MapInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type CameraIntent =
  | { kind: "point"; point: GeoPoint; zoom?: number }
  | { kind: "fit"; points: GeoPoint[] }
  /** Keep these in view as they move (driver and target). */
  | { kind: "follow"; points: GeoPoint[] };

export interface RideMapProps {
  route?: RouteGeometry | null;
  approachRoute?: RouteGeometry | null;
  approaching?: boolean;
  pickup?: GeoPoint | null;
  pickupLabel?: string;
  destination?: GeoPoint | null;
  destinationLabel?: string;
  user?: GeoPoint | null;
  vehicle?: MapVehicle | null;
  nearby?: Array<{ id: string; point: GeoPoint; heading: number }>;
  /** Concentric search pulses around a point (driver search). */
  radar?: GeoPoint | null;
  camera: CameraIntent | null;
  /** Change to re-apply the camera even if the person has panned. */
  cameraKey: string;
  /** Increment to recenter after the person has explored the map. */
  recenterToken?: number;
  /** Screen space covered by controls/panels, used for camera framing only. */
  insets: MapInsets;
  /** Centre-pin mode: report the point under the pin when the map settles. */
  onCenterChange?: (point: GeoPoint, settled: boolean) => void;
  /** Fired once when the person moves the map themselves. */
  onUserMove?: () => void;
  onReady?: () => void;
  onError?: () => void;
  interactive?: boolean;
  className?: string;
}

