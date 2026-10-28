import type { VehicleClass } from "../domain/types";

/**
 * Marker markup for Google Maps overlays. Plain HTML/SVG strings so markers are
 * crisp at any zoom, themed through CSS variables, and cost nothing to load.
 * Colours come from the `--ride-*` aliases; none are hard-coded here except
 * the vehicle's own paint, which is data.
 */

export const MARKER_SIZES = {
  pickup: 28,
  destination: 34,
  user: 22,
  vehicle: 44,
  nearby: 30,
  radar: 220,
} as const;

export function pickupMarkerHtml(label?: string): string {
  return `
    <div class="relative flex size-7 items-center justify-center" aria-hidden="true">
      <span class="absolute inset-0 rounded-full bg-[var(--ride-marker-pickup,var(--kx-gold-500))] opacity-20"></span>
      <span class="relative size-4 rounded-full border-[3px] border-white bg-[var(--ride-marker-pickup,var(--kx-gold-500))] shadow-[var(--ride-elev-1,var(--kx-shadow-md))] dark:border-[var(--kx-graphite-950)]"></span>
      ${label ? markerLabel(label, "left-8") : ""}
    </div>`;
}

export function destinationMarkerHtml(label?: string): string {
  return `
    <div class="relative flex size-[34px] items-end justify-center" aria-hidden="true">
      <svg width="26" height="34" viewBox="0 0 26 34" style="filter: drop-shadow(0 3px 6px rgb(16 44 40 / 0.28))">
        <path d="M13 33c0 0 12-12.4 12-20.2C25 6.1 19.6 1 13 1S1 6.1 1 12.8C1 20.6 13 33 13 33z" fill="var(--ride-marker-destination,var(--kx-gold-500))"/>
        <rect x="8.5" y="8.3" width="9" height="9" rx="2" fill="var(--kx-gold-400)"/>
      </svg>
      ${label ? markerLabel(label, "left-9 bottom-4") : ""}
    </div>`;
}

function markerLabel(text: string, position: string): string {
  const safe = text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
  return `<span class="pointer-events-none absolute ${position} max-w-[11rem] truncate whitespace-nowrap rounded-full bg-[var(--surface-primary,var(--kx-surface))] px-2.5 py-1 text-[0.75rem] font-semibold text-[var(--text-primary,var(--kx-text))] shadow-[var(--ride-elev-1,var(--kx-shadow-md))]">${safe}</span>`;
}

export function userMarkerHtml(): string {
  return `
    <div class="relative flex size-[22px] items-center justify-center" aria-hidden="true">
      <span class="ride-pulse-ring absolute -inset-3 rounded-full bg-[var(--ride-info,var(--kx-lilac-600))] opacity-30"></span>
      <span class="relative size-[18px] rounded-full border-[3px] border-white bg-[var(--ride-info,var(--kx-lilac-600))] shadow-[var(--ride-elev-1,var(--kx-shadow-md))]"></span>
    </div>`;
}

/** Top-down vehicle silhouettes, proportioned per class. */
const BODY: Record<VehicleClass, { w: number; h: number; r: number }> = {
  compact: { w: 16, h: 30, r: 6 },
  sedan: { w: 17, h: 33, r: 6 },
  suv: { w: 19, h: 34, r: 6 },
  van: { w: 20, h: 37, r: 5 },
  premium: { w: 17, h: 35, r: 7 },
};

export function vehicleSvg(vehicleClass: VehicleClass, paint: string, size: number = MARKER_SIZES.vehicle): string {
  const body = BODY[vehicleClass];
  const x = (size - body.w) / 2;
  const y = (size - body.h) / 2;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <ellipse cx="${size / 2}" cy="${size / 2 + 2}" rx="${body.w / 2 + 3}" ry="${body.h / 2 + 2}" fill="rgb(16 44 40 / 0.22)" filter="blur(2px)"/>
      <rect x="${x}" y="${y}" width="${body.w}" height="${body.h}" rx="${body.r}" fill="${paint}" stroke="rgb(16 44 40 / 0.35)" stroke-width="0.8"/>
      <rect x="${x + 2.2}" y="${y + body.h * 0.2}" width="${body.w - 4.4}" height="${body.h * 0.2}" rx="2.5" fill="rgb(22 33 31 / 0.78)"/>
      <rect x="${x + 2.6}" y="${y + body.h * 0.66}" width="${body.w - 5.2}" height="${body.h * 0.14}" rx="2" fill="rgb(22 33 31 / 0.6)"/>
      <rect x="${x + 2.4}" y="${y + body.h * 0.43}" width="${body.w - 4.8}" height="${body.h * 0.2}" rx="1.5" fill="rgb(255 255 255 / 0.16)"/>
      <circle cx="${x + 3.4}" cy="${y + 1.8}" r="1.2" fill="#fff7d6"/>
      <circle cx="${x + body.w - 3.4}" cy="${y + 1.8}" r="1.2" fill="#fff7d6"/>
    </svg>`;
}

export function vehicleMarkerHtml(vehicleClass: VehicleClass, paint: string): string {
  return `<div class="ride-vehicle-glyph" style="width:${MARKER_SIZES.vehicle}px;height:${MARKER_SIZES.vehicle}px">${vehicleSvg(vehicleClass, paint)}</div>`;
}

export function nearbyVehicleHtml(): string {
  return `<div class="ride-vehicle-glyph opacity-80" style="width:${MARKER_SIZES.nearby}px;height:${MARKER_SIZES.nearby}px">${vehicleSvg("compact", "var(--kx-neutral-300)", MARKER_SIZES.nearby)}</div>`;
}

export function radarHtml(): string {
  const s = MARKER_SIZES.radar;
  return `
    <div class="pointer-events-none relative" style="width:${s}px;height:${s}px" aria-hidden="true">
      <span class="ride-pulse-ring absolute inset-0 rounded-full border border-[var(--ride-primary,var(--premium-action))] bg-[color-mix(in_srgb,var(--ride-primary,var(--premium-action))_14%,transparent)]"></span>
      <span class="ride-pulse-ring absolute inset-0 rounded-full border border-[var(--ride-primary,var(--premium-action))] bg-[color-mix(in_srgb,var(--ride-primary,var(--premium-action))_10%,transparent)]" style="animation-delay:0.85s"></span>
      <span class="ride-pulse-ring absolute inset-0 rounded-full border border-[var(--ride-primary,var(--premium-action))]" style="animation-delay:1.7s"></span>
    </div>`;
}
