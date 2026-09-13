"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useMotionValue, type PanInfo } from "motion/react";
import { cn } from "@/lib/cn";
import { SHEET_DETENTS, type SheetDetent } from "@/constants/design-tokens";
import { transitions } from "@/lib/motion";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

/**
 * Draggable bottom sheet, Uber/Bolt/Apple Maps style.
 *
 * Snaps between three detents (20% / 45% / 85% of the viewport). The map sits
 * behind it and stays interactive.
 */

export interface BottomSheetProps {
  children: ReactNode;
  detent?: SheetDetent;
  onDetentChange?: (detent: SheetDetent) => void;
  /** Detents this sheet may snap to, in order. */
  allowed?: SheetDetent[];
  /** Accessible label for the sheet region. */
  label: string;
  className?: string;
  contentClassName?: string;
}

const ORDER: SheetDetent[] = ["collapsed", "medium", "expanded"];

export function BottomSheet({
  children,
  detent: controlledDetent,
  onDetentChange,
  allowed = ORDER,
  label,
  className,
  contentClassName,
}: BottomSheetProps) {
  const { prefersReduced } = useReducedMotionSafe();
  const [internalDetent, setInternalDetent] = useState<SheetDetent>(
    allowed[0] ?? "medium",
  );
  const detent = controlledDetent ?? internalDetent;

  const [viewportHeight, setViewportHeight] = useState(0);
  const y = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function measure() {
      setViewportHeight(window.innerHeight);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const heightFor = useCallback(
    (value: SheetDetent) => viewportHeight * SHEET_DETENTS[value],
    [viewportHeight],
  );

  const setDetent = useCallback(
    (next: SheetDetent) => {
      if (!allowed.includes(next)) return;
      if (!controlledDetent) setInternalDetent(next);
      onDetentChange?.(next);
    },
    [allowed, controlledDetent, onDetentChange],
  );

  const handleDragEnd = useCallback(
    (_event: unknown, info: PanInfo) => {
      const currentHeight = heightFor(detent);
      // Dragging down increases y, which reduces the effective height.
      const projected = currentHeight - info.offset.y - info.velocity.y * 0.12;

      let closest = allowed[0];
      let smallestDelta = Infinity;

      for (const candidate of allowed) {
        const delta = Math.abs(heightFor(candidate) - projected);
        if (delta < smallestDelta) {
          smallestDelta = delta;
          closest = candidate;
        }
      }

      y.set(0);
      setDetent(closest);
    },
    [allowed, detent, heightFor, setDetent, y],
  );

  function cycleDetent(direction: 1 | -1) {
    const index = allowed.indexOf(detent);
    const next = allowed[index + direction];
    if (next) setDetent(next);
  }

  return (
    <motion.div
      ref={containerRef}
      role="region"
      aria-label={label}
      drag={prefersReduced ? false : "y"}
      dragElastic={{ top: 0.04, bottom: 0.12 }}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      style={{ y }}
      animate={{ height: viewportHeight ? heightFor(detent) : "45%" }}
      transition={transitions.sheet}
      className={cn(
        "absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-[var(--kx-radius-2xl)] bg-surface shadow-sheet",
        "border-t border-line",
        className,
      )}
    >
      {/* Drag handle — also a keyboard control for the same behaviour. */}
      <div className="flex shrink-0 cursor-grab justify-center py-3 active:cursor-grabbing">
        <button
          type="button"
          aria-label={`${label} — resize`}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") {
              event.preventDefault();
              cycleDetent(1);
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              cycleDetent(-1);
            }
          }}
          onClick={() =>
            cycleDetent(detent === allowed[allowed.length - 1] ? -1 : 1)
          }
          className="kx-tap rounded-full p-1.5"
        >
          <span className="block h-1 w-10 rounded-full bg-[color-mix(in_srgb,var(--kx-text)_18%,transparent)]" />
        </button>
      </div>

      <div
        className={cn(
          "kx-scroll-thin flex-1 overflow-y-auto overscroll-contain px-5 pb-safe",
          contentClassName,
        )}
      >
        {children}
      </div>
    </motion.div>
  );
}
