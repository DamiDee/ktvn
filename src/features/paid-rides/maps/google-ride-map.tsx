"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PAID_RIDES_CONFIG } from "../config";
import type { GeoPoint } from "../domain/types";
import type { RideMapProps } from "./leaflet-ride-map";
import { loadGoogleLibrary, onGoogleMapsAuthFailure } from "./google-maps-loader";
import { MARKER_SIZES, destinationMarkerHtml, nearbyVehicleHtml, pickupMarkerHtml, radarHtml, userMarkerHtml, vehicleMarkerHtml } from "./markers";

type Marker = { id: string; point: GeoPoint; html: string; size: number; heading?: number; anchorY?: number; z?: number };
type HtmlOverlay = google.maps.OverlayView & { update(marker: Marker): void };

/** OverlayView keeps our existing markers without requiring a cloud map ID. */
function createOverlay(marker: Marker, map: google.maps.Map): HtmlOverlay {
  class Overlay extends google.maps.OverlayView {
    private marker = marker;
    private element = document.createElement("div");
    private frame = 0;
    private point = marker.point;
    private heading = marker.heading ?? 0;
    onAdd() { this.element.style.position = "absolute"; this.element.style.pointerEvents = "none"; this.getPanes()?.overlayLayer.append(this.element); this.paint(); }
    draw() {
      const pixel = this.getProjection()?.fromLatLngToDivPixel(new google.maps.LatLng(this.point));
      if (!pixel) return;
      this.element.style.left = `${pixel.x}px`; this.element.style.top = `${pixel.y}px`;
    }
    private paint() {
      this.element.innerHTML = this.marker.html;
      this.element.style.width = `${this.marker.size}px`; this.element.style.height = `${this.marker.size}px`;
      this.element.style.zIndex = String(this.marker.z ?? 1);
      this.element.style.transform = `translate(-50%, -${(this.marker.anchorY ?? 0.5) * 100}%) rotate(${this.heading}deg)`;
      this.draw();
    }
    update(next: Marker) {
      cancelAnimationFrame(this.frame);
      const from = this.point, rotation = this.heading;
      const delta = (((next.heading ?? 0) - rotation + 540) % 360) - 180;
      this.marker = next;
      if (next.heading == null || matchMedia("(prefers-reduced-motion: reduce)").matches) {
        this.point = next.point; this.heading = next.heading ?? 0; this.paint(); return;
      }
      const start = performance.now();
      const animate = (now: number) => {
        const t = Math.min(1, (now - start) / 950);
        this.point = { lat: from.lat + (next.point.lat - from.lat) * t, lng: from.lng + (next.point.lng - from.lng) * t };
        this.heading = rotation + delta * t; this.paint();
        if (t < 1) this.frame = requestAnimationFrame(animate);
      };
      this.frame = requestAnimationFrame(animate);
    }
    onRemove() { cancelAnimationFrame(this.frame); this.element.remove(); }
  }
  const overlay = new Overlay(); overlay.setMap(map); return overlay;
}

export function GoogleRideMap(props: RideMapProps) {
  const container = useRef<HTMLDivElement>(null), map = useRef<google.maps.Map | null>(null);
  const latest = useRef(props), moved = useRef(false), lastFit = useRef(0);
  const overlays = useRef(new Map<string, HtmlOverlay>());
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => { latest.current = props; });

  useEffect(() => {
    let cancelled = false;
    const markers = overlays.current;
    const listeners: google.maps.MapsEventListener[] = [];
    const offAuthFailure = onGoogleMapsAuthFailure(() => latest.current.onError?.());
    const host = container.current;
    const userMove = (event: Event) => {
      if (event instanceof KeyboardEvent && !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "+", "-", "="].includes(event.key)) return;
      moved.current = true; latest.current.onUserMove?.();
    };
    for (const name of ["wheel", "touchstart", "keydown"]) host?.addEventListener(name, userMove, { passive: true });
    let observer: ResizeObserver | undefined;
    void loadGoogleLibrary("maps").then(({ Map: GoogleMap }) => {
      if (cancelled || !container.current) return;
      const initial = latest.current.camera;
      const instance = new GoogleMap(container.current, {
        center: initial?.kind === "point" ? initial.point : initial?.points[0] ?? PAID_RIDES_CONFIG.defaultCenter,
        zoom: initial?.kind === "point" ? initial.zoom ?? 15 : PAID_RIDES_CONFIG.defaultZoom,
        mapTypeControl: false, fullscreenControl: false, streetViewControl: false,
        clickableIcons: false, gestureHandling: "greedy", keyboardShortcuts: true,
        colorScheme: "FOLLOW_SYSTEM", zoomControl: false,
      });
      map.current = instance;
      listeners.push(instance.addListener("dragstart", () => { moved.current = true; latest.current.onUserMove?.(); }));
      const report = (settled: boolean) => {
        const center = instance.getCenter();
        if (center) latest.current.onCenterChange?.(center.toJSON(), settled);
      };
      listeners.push(instance.addListener("center_changed", () => report(false)));
      listeners.push(instance.addListener("idle", () => report(true)));
      listeners.push(google.maps.event.addListenerOnce(instance, "idle", () => {
        if (!cancelled) { setReady(true); latest.current.onReady?.(); }
      }));
      observer = new ResizeObserver(() => google.maps.event.trigger(instance, "resize"));
      observer.observe(container.current);
    }).catch(() => { if (!cancelled) latest.current.onError?.(); });
    return () => {
      cancelled = true; observer?.disconnect(); listeners.forEach((listener) => listener.remove());
      offAuthFailure();
      for (const name of ["wheel", "touchstart", "keydown"]) host?.removeEventListener(name, userMove);
      markers.forEach((overlay) => overlay.setMap(null)); markers.clear();
      if (map.current) google.maps.event.clearInstanceListeners(map.current);
      map.current = null;
    };
  }, []);

  const cameraKey = useRef("");
  const insetKey = useRef("");
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !props.camera) return;
    const key = `${props.cameraKey}:${props.recenterToken ?? 0}`;
    const force = key !== cameraKey.current;
    const insets = JSON.stringify(props.insets);
    const resized = insets !== insetKey.current;
    insetKey.current = insets;
    if (force) { moved.current = false; cameraKey.current = key; }
    if (moved.current && !force) return;
    const camera = props.camera;
    // A pin reports its center into parent state. Reapplying point cameras on
    // every such render would fight dragging and repeatedly unset readiness.
    if (!force && !resized && camera.kind !== "follow") return;
    if (camera.kind === "point") {
      instance.setCenter(camera.point); instance.setZoom(camera.zoom ?? 15);
    } else {
      if (!camera.points.length || (!force && camera.kind === "follow" && Date.now() - lastFit.current < 4_000)) return;
      const bounds = new google.maps.LatLngBounds(); camera.points.forEach((point) => bounds.extend(point));
      instance.fitBounds(bounds, 36); lastFit.current = Date.now();
      google.maps.event.addListenerOnce(instance, "idle", () => {
        if ((instance.getZoom() ?? 0) > 17) instance.setZoom(17);
      });
    }
  }, [ready, props.camera, props.cameraKey, props.recenterToken, props.insets]);

  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.setOptions({ gestureHandling: props.interactive === false ? "none" : "greedy", keyboardShortcuts: props.interactive !== false });
  }, [ready, props.interactive]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const markers: Marker[] = [];
    if (props.pickup) markers.push({ id: "pickup", point: props.pickup, html: pickupMarkerHtml(props.pickupLabel), size: MARKER_SIZES.pickup });
    if (props.destination) markers.push({ id: "destination", point: props.destination, html: destinationMarkerHtml(props.destinationLabel), size: MARKER_SIZES.destination, anchorY: 1 });
    if (props.user) markers.push({ id: "user", point: props.user, html: userMarkerHtml(), size: MARKER_SIZES.user });
    if (props.vehicle) markers.push({ id: "vehicle", point: props.vehicle.point, html: vehicleMarkerHtml(props.vehicle.vehicleClass, props.vehicle.paint ?? "var(--kx-gold-400)"), size: MARKER_SIZES.vehicle, heading: props.vehicle.heading ?? 0, z: 10 });
    if (props.radar) markers.push({ id: "radar", point: props.radar, html: radarHtml(), size: MARKER_SIZES.radar, z: 0 });
    props.nearby?.forEach((vehicle) => markers.push({ id: `nearby:${vehicle.id}`, point: vehicle.point, html: nearbyVehicleHtml(), size: MARKER_SIZES.nearby, heading: vehicle.heading }));
    const ids = new Set(markers.map((marker) => marker.id));
    overlays.current.forEach((overlay, id) => { if (!ids.has(id)) { overlay.setMap(null); overlays.current.delete(id); } });
    markers.forEach((marker) => {
      const existing = overlays.current.get(marker.id);
      if (existing) existing.update(marker);
      else overlays.current.set(marker.id, createOverlay(marker, map.current!));
    });
  }, [ready, props.pickup, props.pickupLabel, props.destination, props.destinationLabel, props.user, props.vehicle, props.radar, props.nearby]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const lines: google.maps.Polyline[] = [];
    const add = (points: GeoPoint[], color: string, width: number, opacity: number) => {
      lines.push(new google.maps.Polyline({ map: map.current!, path: points, strokeColor: color, strokeWeight: width, strokeOpacity: opacity, clickable: false }));
    };
    if (props.route?.source === "road") { add(props.route.points, "#ffffff", 8, 0.85); add(props.route.points, "#174b3d", 5, 1); }
    if (props.approachRoute?.source === "road") add(props.approachRoute.points, "#b38228", 5, 0.95);
    return () => lines.forEach((line) => line.setMap(null));
  }, [ready, props.route, props.approachRoute]);

  // Size the actual map to the uncovered area. Its built-in Google logo and
  // copyright remain visible above bottom sheets and beside desktop panels.
  return <div className={props.className}>
    <div ref={container} className="absolute" style={{ top: props.insets.top, right: props.insets.right, bottom: props.insets.bottom, left: props.insets.left }} role="region" aria-label="Google Maps ride map" />
  </div>;
}
