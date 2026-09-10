"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import {
  boundsOf,
  fitBoundsToAspect,
  project,
  slicePath,
  toSmoothSvgPath,
} from "@/lib/geo";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import { useElementSize } from "@/hooks/use-element-size";
import { MapUnavailableNotice } from "@/components/ui/states";
import { MapDefs, MapTerrain } from "./map-terrain";
import { MapMarkerGlyph, SearchRings } from "./map-markers";
import type { MapCanvasProps } from "./map-types";

/** Fallback viewBox used for the first paint, before the container is measured. */
const FALLBACK_WIDTH = 1000;
const FALLBACK_HEIGHT = 700;

/**
 * The map surface.
 *
 * Renders routes and markers in a projected SVG viewport. Camera framing is
 * derived from `viewport.focus` and animates via the bounds, so recentering
 * glides rather than jumps.
 */
export function MapCanvas({
  routes = [],
  markers = [],
  viewport,
  loading = false,
  loadingMessage = "Locating you…",
  degraded = false,
  searching = false,
  className,
  children,
  description,
}: MapCanvasProps) {
  const { prefersReduced } = useReducedMotionSafe();
  const [containerRef, size] = useElementSize();

  // Draw in the container's own pixel space so the projection never distorts
  // and nothing is cropped away by preserveAspectRatio.
  const viewWidth = size.width > 0 ? size.width : FALLBACK_WIDTH;
  const viewHeight = size.height > 0 ? size.height : FALLBACK_HEIGHT;

  const bounds = useMemo(() => {
    const focus = viewport?.focus?.length
      ? viewport.focus
      : [
          ...routes.flatMap((route) => route.path.points),
          ...markers.map((marker) => marker.position),
        ];

    const raw = boundsOf(focus, viewport?.padding ?? 0.2);
    const fitted = fitBoundsToAspect(raw, viewWidth / viewHeight);

    // Grow into the obscured strips so they hold empty map, not pins. Growing
    // east shifts content west of a right-hand panel; growing south shifts it
    // above a bottom sheet.
    const insetRight = viewport?.insetRight ?? 0;
    const insetBottom = viewport?.insetBottom ?? 0;

    const { maxLat, minLng } = fitted;
    let { minLat, maxLng } = fitted;

    if (insetRight > 0 && insetRight < viewWidth) {
      const scale = viewWidth / (viewWidth - insetRight);
      maxLng = minLng + (maxLng - minLng) * scale;
    }

    if (insetBottom > 0 && insetBottom < viewHeight) {
      const scale = viewHeight / (viewHeight - insetBottom);
      minLat = maxLat - (maxLat - minLat) * scale;
    }

    return { minLat, maxLat, minLng, maxLng };
  }, [viewport, routes, markers, viewWidth, viewHeight]);

  const projectedRoutes = useMemo(
    () =>
      routes.map((route) => {
        const allPoints = route.path.points.map((point) =>
          project(point, bounds, viewWidth, viewHeight),
        );

        const travelled =
          route.progress && route.progress > 0
            ? slicePath(route.path.points, route.progress).map((point) =>
                project(point, bounds, viewWidth, viewHeight),
              )
            : [];

        return {
          ...route,
          d: toSmoothSvgPath(allPoints),
          travelledD: travelled.length > 1 ? toSmoothSvgPath(travelled) : "",
        };
      }),
    [routes, bounds, viewWidth, viewHeight],
  );

  const projectedMarkers = useMemo(
    () =>
      markers.map((marker) => ({
        ...marker,
        point: project(marker.position, bounds, viewWidth, viewHeight),
      })),
    [markers, bounds, viewWidth, viewHeight],
  );

  const searchOrigin = projectedMarkers.find(
    (marker) => marker.kind === "pickup" || marker.kind === "passenger",
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative isolate overflow-hidden bg-[var(--kx-map-land)]",
        className,
      )}
      role="img"
      aria-label={description}
    >
      <svg
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
        aria-hidden
      >
        <MapDefs />

        <MapTerrain
          bounds={bounds}
          width={viewWidth}
          height={viewHeight}
          animate={!prefersReduced}
        />

        {/* Routes: alternates first, primary on top. */}
        {projectedRoutes
          .filter((route) => route.variant === "alternate")
          .map((route) => (
            <path
              key={route.id}
              d={route.d}
              fill="none"
              stroke="var(--kx-map-route-alt)"
              strokeWidth={7}
              strokeLinecap="round"
              strokeDasharray="2 14"
            />
          ))}

        {projectedRoutes
          .filter((route) => route.variant !== "alternate")
          .map((route) => (
            <g key={route.id}>
              {/* Casing keeps the route legible over pale roads. */}
              <path
                d={route.d}
                fill="none"
                stroke="var(--kx-surface)"
                strokeWidth={13}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.75}
              />
              <motion.path
                d={route.d}
                fill="none"
                stroke="url(#kx-route-primary)"
                strokeWidth={8}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{
                  pathLength: route.animateDraw && !prefersReduced ? 0 : 1,
                  opacity: route.travelledD ? 0.42 : 1,
                }}
                animate={{ pathLength: 1, opacity: route.travelledD ? 0.42 : 1 }}
                transition={{ duration: prefersReduced ? 0 : 1.15, ease: "easeInOut" }}
              />

              {/* Travelled portion, drawn solid over the faded remainder. */}
              {route.travelledD ? (
                <path
                  d={route.travelledD}
                  fill="none"
                  stroke="url(#kx-route-primary)"
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
            </g>
          ))}

        {/* Search rings around the pickup point. */}
        {searching && searchOrigin ? (
          <g transform={`translate(${searchOrigin.point.x} ${searchOrigin.point.y})`}>
            <SearchRings />
          </g>
        ) : null}

        {/* Markers */}
        <AnimatePresence>
          {projectedMarkers.map((marker) => (
            <motion.g
              key={marker.id}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{
                opacity: 1,
                scale: 1,
                x: marker.point.x,
                y: marker.point.y,
              }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{
                x: { type: "spring", stiffness: 90, damping: 20 },
                y: { type: "spring", stiffness: 90, damping: 20 },
                opacity: { duration: 0.25 },
                scale: { type: "spring", stiffness: 260, damping: 22 },
              }}
              style={{ cursor: marker.onClick ? "pointer" : undefined }}
              onClick={marker.onClick}
            >
              <MapMarkerGlyph
                kind={marker.kind}
                heading={marker.heading}
                track={marker.track}
                pulse={marker.pulse}
              />
            </motion.g>
          ))}
        </AnimatePresence>
      </svg>

      {/* Loading: roads fade in behind a soft veil with the pulse and message. */}
      <AnimatePresence>
        {loading ? (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--kx-map-land)]/70 backdrop-blur-[2px]"
          >
            <div className="flex flex-col items-center gap-3">
              <span className="relative flex size-4">
                <span
                  className="absolute inline-flex size-full rounded-full bg-forest-500/50"
                  style={{ animation: "kx-pulse-ring 2s ease-out infinite" }}
                />
                <span className="relative inline-flex size-4 rounded-full border-2 border-white bg-forest-700" />
              </span>
              <p className="type-meta text-ink-secondary">{loadingMessage}</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Degraded: keep the last known view, add a notice. */}
      {degraded ? (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4">
          <MapUnavailableNotice className="pointer-events-auto" />
        </div>
      ) : null}

      {/* Overlay slot for ETA chips, sheets and controls. */}
      {children}
    </div>
  );
}
