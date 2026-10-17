"use client";

import "leaflet/dist/leaflet.css";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { useTheme } from "next-themes";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import { PAID_RIDES_CONFIG } from "../config";
import type { GeoPoint, RouteGeometry, VehicleClass } from "../domain/types";
import type { RideMapHandle } from "./map-provider";
import { mapTileSource } from "@/lib/map-tiles";
import {
  MARKER_SIZES,
  destinationMarkerHtml,
  nearbyVehicleHtml,
  pickupMarkerHtml,
  radarHtml,
  userMarkerHtml,
  vehicleMarkerHtml,
} from "./markers";

/**
 * Leaflet implementation of the ride map.
 *
 * Screens describe *what* to show (props) and a camera intent (`camera` +
 * `cameraKey`); this component owns the imperative map. It never recreates
 * the Leaflet instance, interpolates the vehicle between updates instead of
 * teleporting it, keeps important markers inside the part of the map the
 * sheet doesn't cover, and stops following once the person pans — until they
 * tap Recenter.
 */

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

const VEHICLE_TWEEN_MS = 950;
const FOLLOW_REFIT_MS = 4_000;

function toLatLng(point: GeoPoint): [number, number] {
  return [point.lat, point.lng];
}

function shortestRotation(from: number, to: number): number {
  const delta = ((to - from + 540) % 360) - 180;
  return from + delta;
}

export const LeafletRideMap = forwardRef<RideMapHandle, RideMapProps>(function LeafletRideMap(props, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const tiles = useRef<Leaflet.TileLayer | null>(null);
  const layers = useRef<{
    route?: Leaflet.Polyline;
    routeCasing?: Leaflet.Polyline;
    approach?: Leaflet.Polyline;
    pickup?: Leaflet.Marker;
    destination?: Leaflet.Marker;
    user?: Leaflet.Marker;
    vehicle?: Leaflet.Marker;
    radar?: Leaflet.Marker;
    nearby: Map<string, Leaflet.Marker>;
  }>({ nearby: new Map() });
  const vehicleState = useRef<{ from: GeoPoint; to: GeoPoint; start: number; frame: number | null; rotation: number; key: string } | null>(null);
  const userMoved = useRef(false);
  const programmatic = useRef(false);
  const lastFollowFit = useRef(0);
  const latest = useRef(props);
  const [ready, setReady] = useState(false);
  const { resolvedTheme } = useTheme();
  const { prefersReduced } = useReducedMotionSafe();

  useEffect(() => {
    latest.current = props;
  });

  // ─── Camera ───────────────────────────────────────────────────────────

  const padding = useCallback((): { topLeft: [number, number]; bottomRight: [number, number] } => {
    const { insets } = latest.current;
    const size = map.current?.getSize();
    let top = insets.top + 32;
    let bottom = insets.bottom + 32;
    let left = insets.left + 32;
    let right = insets.right + 32;
    // Never pad away the whole map (tiny windows, keyboard open): keep at
    // least a 96px window, otherwise fitBounds would zoom to the maximum.
    if (size) {
      const spareY = size.y - 96 - top - bottom;
      if (spareY < 0) {
        const scale = Math.max(0, (size.y - 96) / (top + bottom));
        top *= scale;
        bottom *= scale;
      }
      const spareX = size.x - 96 - left - right;
      if (spareX < 0) {
        const scale = Math.max(0, (size.x - 96) / (left + right));
        left *= scale;
        right *= scale;
      }
    }
    return { topLeft: [left, top], bottomRight: [right, bottom] };
  }, []);

  const applyCamera = useCallback(
    (animate: boolean) => {
      const instance = map.current;
      const camera = latest.current.camera;
      if (!instance || !L.current || !camera) return;
      programmatic.current = true;
      const pad = padding();
      const animateOptions = { animate: animate && !prefersReduced, duration: 0.8 };

      if (camera.kind === "point") {
        // Offset the centre so the point sits in the middle of the uncovered area.
        const zoom = camera.zoom ?? Math.max(instance.getZoom(), 15);
        const target = instance.project(toLatLng(camera.point), zoom);
        const { insets } = latest.current;
        const shifted = target.add([(insets.right - insets.left) / 2, (insets.bottom - insets.top) / 2]);
        instance.setView(instance.unproject(shifted, zoom), zoom, animateOptions);
      } else {
        const points = camera.points.filter(Boolean);
        if (points.length === 0) return;
        const bounds = L.current.latLngBounds(points.map(toLatLng));
        instance.fitBounds(bounds, {
          paddingTopLeft: pad.topLeft,
          paddingBottomRight: pad.bottomRight,
          maxZoom: points.length === 1 ? 16 : 17,
          ...animateOptions,
        });
      }
      // moveend fires after animation; release the flag then.
      window.setTimeout(() => (programmatic.current = false), animate && !prefersReduced ? 900 : 50);
    },
    [padding, prefersReduced],
  );

  useImperativeHandle(
    ref,
    () => ({
      fitRouteBounds(points, options) {
        if (!map.current || !L.current || points.length === 0) return;
        const pad = padding();
        map.current.fitBounds(L.current.latLngBounds(points.map(toLatLng)), {
          paddingTopLeft: pad.topLeft,
          paddingBottomRight: pad.bottomRight,
          animate: options?.animate ?? !prefersReduced,
        });
      },
      recenter() {
        userMoved.current = false;
        applyCamera(true);
      },
      getCenter() {
        const center = map.current?.getCenter();
        return center ? { lat: center.lat, lng: center.lng } : null;
      },
    }),
    [applyCamera, padding, prefersReduced],
  );

  // ─── Init (once) ──────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const nearbyLayers = layers.current.nearby;
    void (async () => {
      try {
        const leaflet = (await import("leaflet")).default;
        if (cancelled || !containerRef.current || map.current) return;
        L.current = leaflet;
        const instance = leaflet.map(containerRef.current, {
          zoomControl: false,
          attributionControl: true,
          maxZoom: 18,
          minZoom: 4,
          zoomSnap: 0.25,
          wheelPxPerZoomLevel: 90,
          inertia: true,
          // Keep labels sharp on retina without doubling tile requests.
          preferCanvas: false,
        });
        instance.attributionControl.setPrefix(false);
        instance.setView(toLatLng(PAID_RIDES_CONFIG.defaultCenter), PAID_RIDES_CONFIG.defaultZoom);

        const markUserMove = () => {
          if (programmatic.current) return;
          if (!userMoved.current) {
            userMoved.current = true;
            latest.current.onUserMove?.();
          }
        };
        // Only real gestures count: Leaflet fires zoom events for programmatic
        // camera moves too, so listen to input, not to zoom.
        instance.on("dragstart", markUserMove);
        const container = instance.getContainer();
        container.addEventListener("wheel", markUserMove, { passive: true });
        container.addEventListener("dblclick", markUserMove);
        container.addEventListener("touchstart", (event) => {
          if (event.touches.length > 1) markUserMove();
        }, { passive: true });
        instance.on("move", () => {
          const handler = latest.current.onCenterChange;
          if (handler) handler(centerUnderPin(instance), false);
        });
        instance.on("moveend", () => {
          const handler = latest.current.onCenterChange;
          if (handler) handler(centerUnderPin(instance), true);
        });

        map.current = instance;
        setReady(true);
        latest.current.onReady?.();
      } catch {
        if (!cancelled) latest.current.onError?.();
      }
    })();

    return () => {
      cancelled = true;
      if (vehicleState.current?.frame) cancelAnimationFrame(vehicleState.current.frame);
      map.current?.remove();
      map.current = null;
      tiles.current = null;
      layers.current = { nearby: new Map() };
      nearbyLayers.clear();
    };
  }, []);

  /** The point under the visual pin, which sits in the centre of the uncovered area. */
  function centerUnderPin(instance: Leaflet.Map): GeoPoint {
    const size = instance.getSize();
    const { insets } = latest.current;
    const x = insets.left + (size.x - insets.left - insets.right) / 2;
    const y = insets.top + (size.y - insets.top - insets.bottom) / 2;
    const latLng = instance.containerPointToLatLng([x, y]);
    return { lat: latLng.lat, lng: latLng.lng };
  }

  // ─── Tiles follow the theme ───────────────────────────────────────────

  useEffect(() => {
    const instance = map.current;
    const leaflet = L.current;
    if (!ready || !instance || !leaflet) return;
    const dark = resolvedTheme === "dark";
    const custom = dark ? PAID_RIDES_CONFIG.tiles.dark : PAID_RIDES_CONFIG.tiles.light;
    const source = mapTileSource({ dark, customUrl: custom });
    const { url } = source;
    if (tiles.current && (tiles.current as Leaflet.TileLayer & { _url?: string })._url === url) return;
    tiles.current?.remove();
    tiles.current = leaflet
      .tileLayer(url, {
        maxZoom: 19,
        attribution: source.attribution,
        subdomains: source.subdomains,
        className: source.provider === "custom" ? "ride-tiles-custom" : source.provider === "carto" ? "ride-tiles-light" : "ride-tiles-default",
        detectRetina: false,
      })
      .addTo(instance);
  }, [ready, resolvedTheme]);

  // ─── Interactivity ────────────────────────────────────────────────────

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    const enable = props.interactive !== false;
    for (const handler of [instance.dragging, instance.touchZoom, instance.doubleClickZoom, instance.scrollWheelZoom, instance.keyboard]) {
      if (enable) handler.enable();
      else handler.disable();
    }
  }, [ready, props.interactive]);

  // ─── Routes ───────────────────────────────────────────────────────────

  useEffect(() => {
    const instance = map.current;
    const leaflet = L.current;
    if (!ready || !instance || !leaflet) return;
    const current = layers.current;
    current.route?.remove();
    current.routeCasing?.remove();
    current.route = undefined;
    current.routeCasing = undefined;
    if (props.route && props.route.points.length > 1) {
      const latLngs = props.route.points.map(toLatLng);
      const styles = getComputedStyle(containerRef.current ?? document.body);
      const casing = styles.getPropertyValue("--ride-route-casing").trim() || "#ffffff";
      const color = styles.getPropertyValue("--ride-route").trim() || "#173632";
      current.routeCasing = leaflet.polyline(latLngs, { color: casing, weight: 9, opacity: 0.95, lineCap: "round", lineJoin: "round", interactive: false }).addTo(instance);
      current.route = leaflet
        .polyline(latLngs, {
          color,
          weight: 5,
          opacity: 1,
          lineCap: "round",
          lineJoin: "round",
          interactive: false,
          // An approximate route is drawn dashed so it never reads as exact.
          dashArray: props.route.source === "approximate" ? "2 10" : undefined,
        })
        .addTo(instance);
    }
  }, [ready, props.route, resolvedTheme]);

  useEffect(() => {
    const instance = map.current;
    const leaflet = L.current;
    if (!ready || !instance || !leaflet) return;
    const current = layers.current;
    current.approach?.remove();
    current.approach = undefined;
    if (props.approachRoute && props.approachRoute.points.length > 1) {
      const color = getComputedStyle(containerRef.current ?? document.body).getPropertyValue("--ride-route-approach").trim() || "#c99923";
      current.approach = leaflet
        .polyline(props.approachRoute.points.map(toLatLng), { color, weight: 4, opacity: 0.9, dashArray: "1 9", lineCap: "round", interactive: false })
        .addTo(instance);
    }
  }, [ready, props.approachRoute, resolvedTheme]);

  // ─── Static markers ───────────────────────────────────────────────────

  const placeMarker = useCallback(
    (key: "pickup" | "destination" | "user" | "radar", point: GeoPoint | null | undefined, html: string, size: number, zIndex: number) => {
      const instance = map.current;
      const leaflet = L.current;
      if (!instance || !leaflet) return;
      const current = layers.current;
      if (!point) {
        current[key]?.remove();
        current[key] = undefined;
        return;
      }
      const icon = leaflet.divIcon({ html, className: "ride-marker", iconSize: [size, size], iconAnchor: key === "destination" ? [size / 2, size] : [size / 2, size / 2] });
      if (current[key]) {
        current[key].setLatLng(toLatLng(point));
        current[key].setIcon(icon);
      } else {
        current[key] = leaflet.marker(toLatLng(point), { icon, interactive: false, keyboard: false, zIndexOffset: zIndex }).addTo(instance);
      }
    },
    [],
  );

  useEffect(() => {
    if (ready) placeMarker("pickup", props.pickup, pickupMarkerHtml(props.pickupLabel), MARKER_SIZES.pickup, 300);
  }, [ready, placeMarker, props.pickup, props.pickupLabel]);

  useEffect(() => {
    if (ready) placeMarker("destination", props.destination, destinationMarkerHtml(props.destinationLabel), MARKER_SIZES.destination, 310);
  }, [ready, placeMarker, props.destination, props.destinationLabel]);

  useEffect(() => {
    if (ready) placeMarker("user", props.user, userMarkerHtml(), MARKER_SIZES.user, 200);
  }, [ready, placeMarker, props.user]);

  useEffect(() => {
    if (ready) placeMarker("radar", props.radar, radarHtml(), MARKER_SIZES.radar, 100);
  }, [ready, placeMarker, props.radar]);

  useEffect(() => {
    const instance = map.current;
    const leaflet = L.current;
    if (!ready || !instance || !leaflet) return;
    const existing = layers.current.nearby;
    const wanted = new Set((props.nearby ?? []).map((car) => car.id));
    for (const [id, marker] of existing) {
      if (!wanted.has(id)) {
        marker.remove();
        existing.delete(id);
      }
    }
    for (const car of props.nearby ?? []) {
      const marker = existing.get(car.id);
      if (marker) {
        marker.setLatLng(toLatLng(car.point));
      } else {
        const icon = leaflet.divIcon({ html: nearbyVehicleHtml(), className: "ride-marker", iconSize: [MARKER_SIZES.nearby, MARKER_SIZES.nearby], iconAnchor: [MARKER_SIZES.nearby / 2, MARKER_SIZES.nearby / 2] });
        existing.set(car.id, leaflet.marker(toLatLng(car.point), { icon, interactive: false, keyboard: false }).addTo(instance));
      }
      const glyph = existing.get(car.id)?.getElement()?.querySelector<HTMLElement>(".ride-vehicle-glyph");
      if (glyph) glyph.style.transform = `rotate(${car.heading}deg)`;
    }
  }, [ready, props.nearby]);

  // ─── Vehicle: interpolated, rotated ───────────────────────────────────

  useEffect(() => {
    const instance = map.current;
    const leaflet = L.current;
    if (!ready || !instance || !leaflet) return;
    const current = layers.current;
    const vehicle = props.vehicle;

    if (!vehicle) {
      current.vehicle?.remove();
      current.vehicle = undefined;
      if (vehicleState.current?.frame) cancelAnimationFrame(vehicleState.current.frame);
      vehicleState.current = null;
      return;
    }

    const key = `${vehicle.vehicleClass}:${vehicle.paint ?? ""}`;
    if (!current.vehicle || vehicleState.current?.key !== key) {
      current.vehicle?.remove();
      const icon = leaflet.divIcon({
        html: vehicleMarkerHtml(vehicle.vehicleClass, vehicle.paint ?? "var(--kx-forest-800)"),
        className: "ride-marker",
        iconSize: [MARKER_SIZES.vehicle, MARKER_SIZES.vehicle],
        iconAnchor: [MARKER_SIZES.vehicle / 2, MARKER_SIZES.vehicle / 2],
      });
      current.vehicle = leaflet.marker(toLatLng(vehicle.point), { icon, interactive: false, keyboard: false, zIndexOffset: 500 }).addTo(instance);
      vehicleState.current = { from: vehicle.point, to: vehicle.point, start: performance.now(), frame: null, rotation: vehicle.heading ?? 0, key };
    }

    const state = vehicleState.current!;
    const marker = current.vehicle;
    const glyph = marker.getElement()?.querySelector<HTMLElement>(".ride-vehicle-glyph");
    if (vehicle.heading !== null && glyph) {
      state.rotation = shortestRotation(state.rotation, vehicle.heading);
      glyph.style.transform = `rotate(${state.rotation}deg)`;
    }

    // Tween from wherever the marker is now to the new fix.
    const shown = marker.getLatLng();
    state.from = { lat: shown.lat, lng: shown.lng };
    state.to = vehicle.point;
    state.start = performance.now();
    if (state.frame) cancelAnimationFrame(state.frame);

    if (prefersReduced) {
      marker.setLatLng(toLatLng(vehicle.point));
      state.frame = null;
      return;
    }
    const step = (now: number) => {
      const t = Math.min(1, (now - state.start) / VEHICLE_TWEEN_MS);
      marker.setLatLng([state.from.lat + (state.to.lat - state.from.lat) * t, state.from.lng + (state.to.lng - state.from.lng) * t]);
      state.frame = t < 1 ? requestAnimationFrame(step) : null;
    };
    state.frame = requestAnimationFrame(step);
  }, [ready, props.vehicle, prefersReduced]);

  // ─── Camera intent ────────────────────────────────────────────────────

  const insetsKey = `${props.insets.top}:${props.insets.right}:${Math.round(props.insets.bottom / 24)}:${props.insets.left}`;

  useEffect(() => {
    if (!ready) return;
    userMoved.current = false;
    applyCamera(true);
    // cameraKey is the explicit signal to re-frame.
  }, [ready, props.cameraKey, applyCamera]);

  useEffect(() => {
    if (!ready || !props.recenterToken) return;
    userMoved.current = false;
    applyCamera(true);
  }, [ready, props.recenterToken, applyCamera]);

  useEffect(() => {
    // Sheet height changed: keep the subject in the uncovered area.
    if (ready && !userMoved.current) applyCamera(true);
  }, [ready, insetsKey, applyCamera]);

  useEffect(() => {
    // Following: refit occasionally as the vehicle moves, never fighting the person.
    if (!ready || props.camera?.kind !== "follow" || userMoved.current) return;
    const now = Date.now();
    if (now - lastFollowFit.current < FOLLOW_REFIT_MS) return;
    lastFollowFit.current = now;
    applyCamera(true);
  }, [ready, props.camera, applyCamera]);

  useEffect(() => {
    if (ready) map.current?.invalidateSize({ pan: false });
  }, [ready, insetsKey]);

  return <div ref={containerRef} className={props.className} role="presentation" />;
});
