import type { Coordinates, RoutePath } from "@/types/models";
import type { DriverTrack } from "@/types/enums";

/**
 * Provider-agnostic map contract.
 *
 * `MapCanvas` renders these props today with a self-contained renderer that
 * needs no API key. A Mapbox or Google implementation satisfies the same
 * props, so swapping providers does not touch any calling component.
 */

export type MarkerKind =
  | "pickup"
  | "destination"
  | "vehicle"
  | "passenger"
  | "driver-idle"
  | "driver-moving"
  | "sos";

export interface MapMarkerSpec {
  id: string;
  position: Coordinates;
  kind: MarkerKind;
  /** Rotation in degrees for vehicle markers. */
  heading?: number;
  label?: string;
  track?: DriverTrack;
  pulse?: boolean;
  onClick?: () => void;
}

export interface MapRouteSpec {
  id: string;
  path: RoutePath;
  /** Muted alternates render behind the primary gold route. */
  variant?: "primary" | "alternate";
  /** 0–1 — how much of the route has been travelled. */
  progress?: number;
  /** Animate the stroke drawing itself on first render. */
  animateDraw?: boolean;
}

export interface MapViewport {
  /** Points the camera should keep in frame. */
  focus: Coordinates[];
  /** Extra padding as a fraction of the bounding box. */
  padding?: number;
  /**
   * Width in CSS pixels obscured along the right edge — a floating panel, say.
   * The framing shifts west so nothing important hides underneath it.
   */
  insetRight?: number;
  /**
   * Height in CSS pixels obscured along the bottom edge, such as a bottom
   * sheet on mobile. The framing shifts north by the same logic.
   */
  insetBottom?: number;
}

export interface MapCanvasProps {
  routes?: MapRouteSpec[];
  markers?: MapMarkerSpec[];
  viewport?: MapViewport;
  /** Renders the roads-fading-in skeleton instead of content. */
  loading?: boolean;
  loadingMessage?: string;
  /** Shows the "live location unavailable" notice over the last known view. */
  degraded?: boolean;
  /** Expanding search rings around the first pickup marker. */
  searching?: boolean;
  theme?: "auto" | "light" | "dark";
  className?: string;
  children?: React.ReactNode;
  /** Accessible summary of what the map shows. */
  description: string;
}
