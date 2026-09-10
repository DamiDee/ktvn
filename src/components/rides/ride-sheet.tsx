"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useIsMobile, useMounted } from "@/hooks/use-media-query";
import { transitions } from "@/lib/motion";
import { SHEET_DETENTS, type SheetDetent } from "@/constants/design-tokens";

/**
 * The information surface over a ride map.
 *
 * Mobile gets a draggable bottom sheet (Uber/Bolt pattern); desktop gets a
 * floating side panel, since a sheet over a wide map wastes the space. Same
 * children either way, so screens don't branch on viewport.
 */
/** Panel width on desktop, mirrored from the class below. */
const PANEL_MAX_PX = 400;
const PANEL_VW_FRACTION = 0.38;
const PANEL_GUTTER_PX = 32;

/**
 * How much of the map the sheet covers, in CSS pixels — a right-hand strip on
 * desktop, a bottom strip on mobile. Spread into `MapCanvas.viewport` so pins
 * and routes stay in the visible part of the map.
 */
export function useRideSheetInset(): {
  insetRight: number;
  insetBottom: number;
} {
  const mounted = useMounted();
  const isMobile = useIsMobile();
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const update = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (!mounted || size.width === 0) return { insetRight: 0, insetBottom: 0 };

  if (isMobile) {
    // Framed against the medium detent — the height the sheet rests at.
    return {
      insetRight: 0,
      insetBottom: size.height * SHEET_DETENTS.medium,
    };
  }

  return {
    insetRight:
      Math.min(PANEL_MAX_PX, size.width * PANEL_VW_FRACTION) + PANEL_GUTTER_PX,
    insetBottom: 0,
  };
}

export function RideSheet({
  children,
  label,
  detent,
  onDetentChange,
  allowed,
  className,
}: {
  children: ReactNode;
  label: string;
  detent?: SheetDetent;
  onDetentChange?: (detent: SheetDetent) => void;
  allowed?: SheetDetent[];
  className?: string;
}) {
  const mounted = useMounted();
  const isMobile = useIsMobile();

  // Before mount, render the desktop panel — it degrades gracefully and
  // avoids a sheet flashing into place on hydration.
  if (mounted && isMobile) {
    return (
      <BottomSheet
        label={label}
        detent={detent}
        onDetentChange={onDetentChange}
        allowed={allowed}
        className={className}
      >
        <div className="pb-6">{children}</div>
      </BottomSheet>
    );
  }

  return (
    <motion.aside
      aria-label={label}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={transitions.springGentle}
      className={cn(
        // Hugs its content, capped at the viewport so long journeys scroll
        // inside the panel rather than stretching it to a mostly-empty column.
        "absolute top-4 right-4 z-30 flex max-h-[calc(100%-2rem)] w-[min(400px,38vw)] flex-col overflow-hidden rounded-[var(--kx-radius-xl)] bg-surface shadow-xl",
        "border border-line",
        className,
      )}
    >
      <div className="kx-scroll-thin flex-1 overflow-y-auto p-5">{children}</div>
    </motion.aside>
  );
}
