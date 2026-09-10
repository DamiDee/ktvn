"use client";

import { motion } from "motion/react";
import { DriverTrack } from "@/types/enums";
import type { MarkerKind } from "./map-types";

/**
 * Map markers drawn in SVG user space. Each marker is positioned by its
 * parent via a translate transform, so rotation stays local to the glyph.
 */

export function PickupMarker({ pulse = false }: { pulse?: boolean }) {
  return (
    <g filter="url(#kx-marker-shadow)">
      {pulse ? (
        <circle
          r={16}
          fill="var(--kx-forest-500)"
          opacity={0.25}
          style={{ animation: "kx-pulse-ring 2.4s ease-out infinite" }}
        />
      ) : null}
      <circle r={8} fill="var(--kx-surface)" />
      <circle r={5} fill="var(--kx-forest-700)" />
      <circle r={2} fill="var(--kx-surface)" />
    </g>
  );
}

export function DestinationMarker() {
  return (
    <g filter="url(#kx-marker-shadow)">
      {/* Pin body */}
      <path
        d="M0 2 C-6 -4 -9 -8 -9 -12 A9 9 0 1 1 9 -12 C9 -8 6 -4 0 2 Z"
        fill="var(--kx-forest-800)"
      />
      <circle cy={-12} r={3.6} fill="var(--kx-gold-400)" />
    </g>
  );
}

export function VehicleMarker({
  heading = 0,
  track,
  sos = false,
}: {
  heading?: number;
  track?: DriverTrack;
  sos?: boolean;
}) {
  const body = sos
    ? "var(--kx-sos-500)"
    : track === DriverTrack.PROFESSIONAL
      ? "var(--kx-lilac-600)"
      : "var(--kx-forest-800)";

  return (
    <g filter="url(#kx-marker-shadow)">
      {sos ? (
        <circle
          r={20}
          fill="var(--kx-sos-500)"
          opacity={0.3}
          style={{ animation: "kx-pulse-ring 1.6s ease-out infinite" }}
        />
      ) : null}

      <circle r={12} fill="var(--kx-surface)" opacity={0.92} />

      {/* Rotation is applied to the glyph only, so the halo stays upright. */}
      <g transform={`rotate(${heading})`}>
        <path
          d="M0 -8 L6 7 L0 4 L-6 7 Z"
          fill={body}
          stroke="var(--kx-surface)"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      </g>
    </g>
  );
}

export function DriverDotMarker({
  track,
  moving = false,
}: {
  track?: DriverTrack;
  moving?: boolean;
}) {
  const fill =
    track === DriverTrack.PROFESSIONAL
      ? "var(--kx-lilac-600)"
      : "var(--kx-gold-500)";

  return (
    <g filter="url(#kx-marker-shadow)">
      <circle r={7} fill="var(--kx-surface)" />
      <circle r={4.5} fill={fill} opacity={moving ? 1 : 0.55} />
    </g>
  );
}

export function PassengerMarker({ pulse = true }: { pulse?: boolean }) {
  return (
    <g>
      {pulse ? (
        <>
          <circle
            r={14}
            fill="var(--kx-forest-500)"
            opacity={0.22}
            style={{ animation: "kx-pulse-ring 2.6s ease-out infinite" }}
          />
          <circle
            r={14}
            fill="var(--kx-forest-500)"
            opacity={0.22}
            style={{ animation: "kx-pulse-ring 2.6s ease-out 0.9s infinite" }}
          />
        </>
      ) : null}
      <circle r={7.5} fill="var(--kx-forest-600)" opacity={0.2} />
      <circle r={5} fill="var(--kx-forest-700)" stroke="var(--kx-surface)" strokeWidth={2} />
    </g>
  );
}

export function MapMarkerGlyph({
  kind,
  heading,
  track,
  pulse,
}: {
  kind: MarkerKind;
  heading?: number;
  track?: DriverTrack;
  pulse?: boolean;
}) {
  switch (kind) {
    case "pickup":
      return <PickupMarker pulse={pulse} />;
    case "destination":
      return <DestinationMarker />;
    case "vehicle":
      return <VehicleMarker heading={heading} track={track} />;
    case "sos":
      return <VehicleMarker heading={heading} track={track} sos />;
    case "passenger":
      return <PassengerMarker pulse={pulse} />;
    case "driver-moving":
      return <DriverDotMarker track={track} moving />;
    case "driver-idle":
    default:
      return <DriverDotMarker track={track} />;
  }
}

/** Expanding rings shown while a passenger is being matched. */
export function SearchRings() {
  return (
    <g aria-hidden>
      {[0, 1, 2].map((index) => (
        <circle
          key={index}
          r={40}
          fill="none"
          stroke="var(--kx-gold-500)"
          strokeWidth={1.5}
          opacity={0}
          style={{
            animation: "kx-pulse-ring 3.2s ease-out infinite",
            animationDelay: `${index * 1.05}s`,
          }}
        />
      ))}
      <circle r={5} fill="var(--kx-gold-500)" />
      <motion.circle
        r={12}
        fill="var(--kx-gold-500)"
        opacity={0.2}
        animate={{ scale: [1, 1.18, 1] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
    </g>
  );
}
