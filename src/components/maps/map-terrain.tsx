"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import type { Bounds } from "@/lib/geo";

/**
 * Procedural map terrain.
 *
 * Draws a muted street network, water and parkland derived deterministically
 * from the viewport bounds, so the map reads as a real place without needing
 * a tile provider. A Mapbox/Google layer replaces this component alone.
 */

function seeded(seed: number) {
  let state = Math.abs(Math.floor(seed)) % 2147483647 || 12345;
  return () => {
    state = (state * 48271) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

interface Road {
  d: string;
  width: number;
  minor: boolean;
}

export function MapTerrain({
  bounds,
  width,
  height,
  animate = true,
}: {
  bounds: Bounds;
  width: number;
  height: number;
  animate?: boolean;
}) {
  const { roads, water, parks } = useMemo(() => {
    // Bounds drive the seed so panning to a new area yields a new-but-stable layout.
    const seed = Math.floor(
      (bounds.minLat + bounds.minLng + bounds.maxLat) * 100_000,
    );
    const random = seeded(seed);

    const generatedRoads: Road[] = [];

    // Arterials — a few long, gently curving routes across the frame.
    const arterialCount = 4;
    for (let i = 0; i < arterialCount; i += 1) {
      const horizontal = random() > 0.45;
      const offset = 0.12 + random() * 0.76;

      if (horizontal) {
        const y = height * offset;
        const sag = (random() - 0.5) * height * 0.16;
        generatedRoads.push({
          d: `M ${-width * 0.05} ${y} Q ${width * 0.5} ${y + sag} ${width * 1.05} ${y + sag * 0.4}`,
          width: 7 + random() * 3,
          minor: false,
        });
      } else {
        const x = width * offset;
        const sag = (random() - 0.5) * width * 0.16;
        generatedRoads.push({
          d: `M ${x} ${-height * 0.05} Q ${x + sag} ${height * 0.5} ${x + sag * 0.4} ${height * 1.05}`,
          width: 7 + random() * 3,
          minor: false,
        });
      }
    }

    // Secondary streets — a denser lattice, slightly rotated.
    const secondaryCount = 16;
    for (let i = 0; i < secondaryCount; i += 1) {
      const horizontal = i % 2 === 0;
      const offset = random();
      const skew = (random() - 0.5) * 0.22;

      if (horizontal) {
        const y = height * offset;
        generatedRoads.push({
          d: `M ${-width * 0.05} ${y} L ${width * 1.05} ${y + height * skew}`,
          width: 2.4 + random() * 1.4,
          minor: true,
        });
      } else {
        const x = width * offset;
        generatedRoads.push({
          d: `M ${x} ${-height * 0.05} L ${x + width * skew} ${height * 1.05}`,
          width: 2.4 + random() * 1.4,
          minor: true,
        });
      }
    }

    // A single water body, off to one side.
    const waterX = random() > 0.5 ? width * 0.82 : width * 0.14;
    const waterY = height * (0.2 + random() * 0.55);
    const waterR = Math.min(width, height) * (0.16 + random() * 0.12);
    const generatedWater = `M ${waterX - waterR} ${waterY} C ${waterX - waterR * 0.7} ${waterY - waterR * 0.85}, ${waterX + waterR * 0.8} ${waterY - waterR * 0.7}, ${waterX + waterR} ${waterY + waterR * 0.15} C ${waterX + waterR * 0.6} ${waterY + waterR * 0.95}, ${waterX - waterR * 0.5} ${waterY + waterR * 0.9}, ${waterX - waterR} ${waterY} Z`;

    // Two parkland blocks.
    const generatedParks = Array.from({ length: 2 }, () => {
      const px = width * (0.1 + random() * 0.7);
      const py = height * (0.1 + random() * 0.7);
      const pw = width * (0.08 + random() * 0.13);
      const ph = height * (0.08 + random() * 0.14);
      return { x: px, y: py, width: pw, height: ph, r: 10 + random() * 12 };
    });

    return {
      roads: generatedRoads,
      water: generatedWater,
      parks: generatedParks,
    };
  }, [bounds, width, height]);

  const fadeIn = animate
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { opacity: 1 }, animate: { opacity: 1 } };

  return (
    <g aria-hidden>
      {/* Land base with a subtle vertical wash */}
      <rect x={0} y={0} width={width} height={height} fill="var(--kx-map-land)" />
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="url(#kx-map-wash)"
        opacity={0.7}
      />

      {/* Parkland */}
      <motion.g {...fadeIn} transition={{ duration: 0.5, delay: 0.05 }}>
        {parks.map((park, index) => (
          <rect
            key={index}
            x={park.x}
            y={park.y}
            width={park.width}
            height={park.height}
            rx={park.r}
            fill="var(--kx-map-park)"
          />
        ))}
      </motion.g>

      {/* Water */}
      <motion.path
        d={water}
        fill="var(--kx-map-water)"
        {...fadeIn}
        transition={{ duration: 0.55, delay: 0.08 }}
      />

      {/* Minor streets */}
      <motion.g {...fadeIn} transition={{ duration: 0.6, delay: 0.14 }}>
        {roads
          .filter((road) => road.minor)
          .map((road, index) => (
            <path
              key={`minor-${index}`}
              d={road.d}
              stroke="var(--kx-map-road-minor)"
              strokeWidth={road.width}
              strokeLinecap="round"
              fill="none"
            />
          ))}
      </motion.g>

      {/* Arterials: casing then fill, so junctions read correctly */}
      <motion.g {...fadeIn} transition={{ duration: 0.6, delay: 0.2 }}>
        {roads
          .filter((road) => !road.minor)
          .map((road, index) => (
            <path
              key={`casing-${index}`}
              d={road.d}
              stroke="var(--kx-map-road-stroke)"
              strokeWidth={road.width + 1.6}
              strokeLinecap="round"
              fill="none"
            />
          ))}
        {roads
          .filter((road) => !road.minor)
          .map((road, index) => (
            <path
              key={`fill-${index}`}
              d={road.d}
              stroke="var(--kx-map-road)"
              strokeWidth={road.width}
              strokeLinecap="round"
              fill="none"
            />
          ))}
      </motion.g>
    </g>
  );
}

export function MapDefs() {
  return (
    <defs>
      <linearGradient id="kx-map-wash" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--kx-map-land-2)" stopOpacity="0.9" />
        <stop offset="100%" stopColor="var(--kx-map-land)" stopOpacity="0" />
      </linearGradient>

      <linearGradient id="kx-route-primary" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="var(--kx-gold-600)" />
        <stop offset="55%" stopColor="var(--kx-gold-400)" />
        <stop offset="100%" stopColor="var(--kx-gold-600)" />
      </linearGradient>

      <filter id="kx-marker-shadow" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow
          dx="0"
          dy="1.5"
          stdDeviation="2"
          floodColor="#0c211e"
          floodOpacity="0.28"
        />
      </filter>
    </defs>
  );
}
