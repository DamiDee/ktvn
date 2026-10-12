import { boundsOf, fitBoundsToAspect, project } from "@/lib/geo";
import type { GeoPoint } from "../domain/types";

/**
 * Lightweight canvas renderer for the floating tracker.
 *
 * A second Leaflet instance inside a 320-pixel PiP window would download
 * tiles, hold a full map in memory and redraw constantly. Instead this draws
 * a calm schematic — route, car, target, ETA — in a few milliseconds, at a
 * low frame rate. It powers both Document PiP (as the mini-map) and video
 * PiP (where the canvas *is* the window, so the text is drawn too).
 */

export interface TrackerFrame {
  route: GeoPoint[];
  vehicle: GeoPoint | null;
  heading: number | null;
  target: GeoPoint | null;
  targetKind: "pickup" | "destination";
  etaValue: string;
  etaUnit: string;
  status: string;
  detail: string;
  dark: boolean;
}

const PALETTE = {
  light: { bg: "#eef1ee", road: "#ffffff", route: "#173632", casing: "#ffffff", text: "#16211f", muted: "#4c5551", card: "rgba(255,255,255,0.92)", accent: "#d6a527" },
  dark: { bg: "#171c1a", road: "#262d2a", route: "#e0ad28", casing: "#111513", text: "#f5f5f2", muted: "rgba(245,245,242,0.7)", card: "rgba(23,28,25,0.9)", accent: "#e0ad28" },
};

export function drawTrackerFrame(ctx: CanvasRenderingContext2D, width: number, height: number, frame: TrackerFrame, withText: boolean): void {
  const colors = frame.dark ? PALETTE.dark : PALETTE.light;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);

  // A faint street grid so the schematic reads as a map.
  ctx.strokeStyle = colors.road;
  ctx.lineWidth = 3;
  for (let x = -20; x < width; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 30, height);
    ctx.stroke();
  }
  for (let y = 18; y < height; y += 46) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y - 12);
    ctx.stroke();
  }

  const mapTop = withText ? height * 0.36 : 8;
  const mapHeight = height - mapTop - 8;
  const points = [...frame.route, ...(frame.vehicle ? [frame.vehicle] : []), ...(frame.target ? [frame.target] : [])];
  if (points.length) {
    const bounds = fitBoundsToAspect(boundsOf(points, 0.22), width / mapHeight);
    const toXY = (point: GeoPoint) => {
      const p = project(point, bounds, width, mapHeight);
      return { x: p.x, y: p.y + mapTop };
    };

    if (frame.route.length > 1) {
      for (const [stroke, lineWidth] of [
        [colors.casing, 9],
        [colors.route, 5],
      ] as const) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        frame.route.forEach((point, index) => {
          const { x, y } = toXY(point);
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
    }

    if (frame.target) {
      const { x, y } = toXY(frame.target);
      ctx.fillStyle = frame.targetKind === "pickup" ? colors.route : colors.text;
      if (frame.targetKind === "pickup") {
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = colors.bg;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(x - 6, y - 6, 12, 12);
        ctx.fillStyle = colors.accent;
        ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
      }
    }

    if (frame.vehicle) {
      const { x, y } = toXY(frame.vehicle);
      ctx.translate(x, y);
      ctx.rotate(((frame.heading ?? 0) * Math.PI) / 180);
      ctx.fillStyle = colors.accent;
      ctx.strokeStyle = colors.casing;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(7, 8);
      ctx.lineTo(0, 4);
      ctx.lineTo(-7, 8);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  if (withText) {
    ctx.fillStyle = colors.card;
    ctx.fillRect(0, 0, width, height * 0.34);
    ctx.fillStyle = colors.text;
    ctx.textBaseline = "alphabetic";
    ctx.font = `600 ${Math.round(height * 0.17)}px -apple-system, BlinkMacSystemFont, Inter, sans-serif`;
    ctx.fillText(frame.etaValue, 14, height * 0.2);
    const valueWidth = ctx.measureText(frame.etaValue).width;
    ctx.font = `500 ${Math.round(height * 0.07)}px -apple-system, BlinkMacSystemFont, Inter, sans-serif`;
    ctx.fillStyle = colors.muted;
    ctx.fillText(frame.etaUnit, 18 + valueWidth, height * 0.2);
    ctx.fillStyle = colors.text;
    ctx.font = `600 ${Math.round(height * 0.068)}px -apple-system, BlinkMacSystemFont, Inter, sans-serif`;
    ctx.fillText(frame.status, 14, height * 0.29, width - 28);
    ctx.textAlign = "right";
    ctx.fillStyle = colors.muted;
    ctx.fillText(frame.detail, width - 14, height * 0.2, width * 0.45);
    ctx.textAlign = "left";
  }
  ctx.restore();
}
