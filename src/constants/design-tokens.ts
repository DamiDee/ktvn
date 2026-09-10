/**
 * Design tokens mirrored from `globals.css` for use in TypeScript
 * (motion configs, canvas/SVG drawing, chart palettes).
 *
 * CSS remains the source of truth for anything rendered as a class.
 * Values here exist only where JS needs a literal.
 */

export const RADIUS = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  "2xl": 32,
  full: 999,
} as const;

export const SPACING_UNIT = 4;

/** Motion durations in seconds (framer-motion units). */
export const DURATION = {
  instant: 0.12,
  quick: 0.165,
  card: 0.25,
  page: 0.38,
  mapShort: 0.6,
  mapLong: 1.2,
} as const;

/** Controlled springs — never bouncy. */
export const SPRING = {
  /** Micro-interactions: pills, toggles, chips. */
  snappy: { type: "spring", stiffness: 240, damping: 26, mass: 0.7 },
  /** Cards and sheets. */
  gentle: { type: "spring", stiffness: 200, damping: 24, mass: 0.9 },
  /** Large surfaces, page-level shared layout. */
  soft: { type: "spring", stiffness: 160, damping: 22, mass: 1 },
  /** Bottom sheet drag settle. */
  sheet: { type: "spring", stiffness: 320, damping: 34, mass: 0.85 },
} as const;

export const EASE = {
  standard: [0.32, 0.72, 0, 1],
  out: [0.16, 1, 0.3, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const;

export const BREAKPOINTS = {
  xs: 416,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

/** Chart / data-visualisation series colours. Lilac-led, gold for emphasis. */
export const CHART_SERIES = [
  "var(--kx-lilac-600)",
  "var(--kx-gold-500)",
  "var(--kx-forest-500)",
  "var(--kx-lilac-300)",
  "var(--kx-forest-300)",
  "var(--kx-gold-300)",
] as const;

/** Bottom-sheet detents as viewport fractions (mobile ride UX). */
export const SHEET_DETENTS = {
  collapsed: 0.2,
  medium: 0.45,
  expanded: 0.85,
} as const;

export type SheetDetent = keyof typeof SHEET_DETENTS;
