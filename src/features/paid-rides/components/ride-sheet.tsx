"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useDragControls, type PanInfo } from "motion/react";
import { cn } from "@/lib/cn";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import { SPRING } from "@/constants/design-tokens";

/**
 * The ride sheet: a content-sized bottom sheet on phones, a floating side
 * panel on desktop.
 *
 * On phones it has two resting states — expanded (fits its content up to the
 * available height) and collapsed (only the `peek` row shows, the map gets
 * the screen). It moves with transforms only, never animates height, and
 * reports how much of the map it covers so the camera can keep markers in
 * the visible area. Scrolling inside the content never drags the sheet:
 * only the handle and the peek row do.
 */

export interface RideSheetProps {
  label: string;
  /** Always-visible top row; also the drag area. */
  peek: ReactNode;
  children?: ReactNode;
  /** Sticky footer for the primary action, kept in the thumb zone. */
  footer?: ReactNode;
  collapsible?: boolean;
  /** Pixels of map the sheet covers (mobile: from the bottom; desktop: 0). */
  onCoverChange?: (cover: { bottom: number; left: number }) => void;
  /** Space reserved below the sheet on mobile (floating nav). */
  bottomOffset?: number;
  /** Re-expand whenever this changes (e.g. a new ride phase). */
  resetKey?: string;
  tone?: "default" | "emergency";
  /** Cap on mobile height so the map stays visible (CSS length). */
  maxHeight?: string;
  className?: string;
}

const COLLAPSE_DISTANCE = 72;
const COLLAPSE_VELOCITY = 480;

export function RideSheet({
  label,
  peek,
  children,
  footer,
  collapsible = true,
  onCoverChange,
  bottomOffset = 0,
  resetKey,
  tone = "default",
  maxHeight,
  className,
}: RideSheetProps) {
  const desktop = useIsDesktop();
  const { prefersReduced } = useReducedMotionSafe();
  const controls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [sizes, setSizes] = useState({ sheet: 0, peek: 0 });
  const [lastResetKey, setLastResetKey] = useState(resetKey);

  // A new phase always opens the sheet so its content is seen.
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setCollapsed(false);
  }

  useEffect(() => {
    const sheet = sheetRef.current;
    const peekRow = peekRef.current;
    if (!sheet || !peekRow) return;
    const observer = new ResizeObserver(() => {
      setSizes((current) => {
        const next = { sheet: sheet.offsetHeight, peek: peekRow.offsetHeight };
        return Math.abs(next.sheet - current.sheet) < 1 && Math.abs(next.peek - current.peek) < 1 ? current : next;
      });
    });
    observer.observe(sheet);
    observer.observe(peekRow);
    return () => observer.disconnect();
  }, [desktop]);

  // Handle + peek + safe area stay visible when collapsed.
  const collapsedOffset = Math.max(0, sizes.sheet - sizes.peek - 28);
  const offset = !desktop && collapsible && collapsed ? collapsedOffset : 0;

  useEffect(() => {
    if (!onCoverChange) return;
    if (desktop) {
      const width = sheetRef.current?.getBoundingClientRect().right ?? 0;
      onCoverChange({ bottom: 0, left: width });
    } else {
      onCoverChange({ bottom: Math.max(0, sizes.sheet - offset) + bottomOffset, left: 0 });
    }
  }, [desktop, sizes.sheet, offset, bottomOffset, onCoverChange]);

  const onDragEnd = useCallback(
    (_event: unknown, info: PanInfo) => {
      if (!collapsible) return;
      if (!collapsed && (info.offset.y > COLLAPSE_DISTANCE || info.velocity.y > COLLAPSE_VELOCITY)) setCollapsed(true);
      else if (collapsed && (info.offset.y < -COLLAPSE_DISTANCE / 2 || info.velocity.y < -COLLAPSE_VELOCITY)) setCollapsed(false);
    },
    [collapsed, collapsible],
  );

  if (desktop) {
    return (
      <section
        ref={sheetRef}
        aria-label={label}
        className={cn(
          "pointer-events-auto absolute top-4 bottom-4 left-4 z-30 flex w-[25rem] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-[var(--ride-radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-primary)] shadow-[var(--ride-elev-4)]",
          tone === "emergency" && "ring-2 ring-[var(--ride-sos)]",
          className,
        )}
      >
        <div ref={peekRef} className="shrink-0 px-6 pt-6">
          {peek}
        </div>
        <div className="kx-scroll-thin min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-6 pb-6">{children}</div>
        {footer ? <div className="shrink-0 border-t border-[var(--border-subtle)] px-6 py-4">{footer}</div> : null}
      </section>
    );
  }

  return (
    <motion.section
      ref={sheetRef}
      aria-label={label}
      drag={collapsible && !prefersReduced ? "y" : false}
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.06, bottom: 0.5 }}
      onDragEnd={onDragEnd}
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: offset, opacity: 1 }}
      transition={prefersReduced ? { duration: 0 } : SPRING.sheet}
      style={{
        bottom: bottomOffset,
        maxHeight: maxHeight
          ? `min(${maxHeight}, calc(100dvh - ${bottomOffset}px - var(--ride-safe-top) - 72px))`
          : `calc(100dvh - ${bottomOffset}px - var(--ride-safe-top) - 72px)`,
      }}
      className={cn(
        "pointer-events-auto absolute inset-x-0 z-30 flex flex-col rounded-t-[var(--ride-radius-xl)] border-t border-[var(--border-subtle)] bg-[var(--surface-primary)] shadow-[var(--ride-elev-3)]",
        bottomOffset > 0 && "mx-2 rounded-b-[var(--ride-radius-xl)] border",
        tone === "emergency" && "ring-2 ring-[var(--ride-sos)]",
        className,
      )}
    >
      <div
        ref={peekRef}
        className="shrink-0 touch-none select-none px-5"
        onPointerDown={(event) => collapsible && controls.start(event)}
      >
        <div className="flex justify-center pt-2 pb-1.5">
          {collapsible ? (
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? `Show ${label.toLowerCase()} details` : `Minimise ${label.toLowerCase()}`}
              className="kx-tap flex h-5 w-12 items-center justify-center rounded-full"
            >
              <span className="h-[5px] w-9 rounded-full bg-[color-mix(in_srgb,var(--text-primary)_16%,transparent)]" />
            </button>
          ) : (
            <span className="h-[5px] w-9 rounded-full bg-transparent" />
          )}
        </div>
        <div className="pb-3">{peek}</div>
      </div>

      {children ? (
        <div
          className={cn("kx-scroll-thin min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 transition-opacity duration-200", collapsed && "opacity-0")}
          aria-hidden={collapsed || undefined}
          inert={collapsed || undefined}
        >
          {children}
        </div>
      ) : null}
      {footer ? (
        <div
          className={cn("shrink-0 px-5 pt-3 transition-opacity duration-200", collapsed && "opacity-0")}
          style={{ paddingBottom: bottomOffset > 0 ? 16 : "calc(var(--ride-safe-bottom) + 8px)" }}
          inert={collapsed || undefined}
        >
          {footer}
        </div>
      ) : (
        <div style={{ height: bottomOffset > 0 ? 12 : "var(--ride-safe-bottom)" }} />
      )}
    </motion.section>
  );
}
