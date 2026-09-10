"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

/**
 * The product's loading treatment: a route line that draws itself with a
 * vehicle dot travelling along it. Used instead of circular spinners.
 */

export interface RouteLoaderProps {
  message?: string;
  /** Rotating secondary messages, changed every few seconds. */
  messages?: string[];
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { width: 120, height: 40, stroke: 2, dot: 3.5 },
  md: { width: 200, height: 64, stroke: 2.5, dot: 5 },
  lg: { width: 280, height: 88, stroke: 3, dot: 6 },
} as const;

export function RouteLoader({
  message = "Preparing your journey",
  messages,
  size = "md",
  className,
}: RouteLoaderProps) {
  const { prefersReduced } = useReducedMotionSafe();
  const config = SIZES[size];
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!messages || messages.length < 2) return;
    const timer = setInterval(() => {
      setMessageIndex((index) => (index + 1) % messages.length);
    }, 2600);
    return () => clearInterval(timer);
  }, [messages]);

  const currentMessage = messages?.[messageIndex] ?? message;

  const { width, height, stroke, dot } = config;
  const path = `M ${dot} ${height - dot} C ${width * 0.3} ${height - dot}, ${width * 0.28} ${dot}, ${width * 0.52} ${dot + height * 0.2} S ${width * 0.82} ${height - dot * 3}, ${width - dot} ${dot}`;

  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-4", className)}
      role="status"
      aria-live="polite"
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        fill="none"
        aria-hidden
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="kx-route-glow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--kx-gold-500)" stopOpacity="0.15" />
            <stop offset="50%" stopColor="var(--kx-gold-500)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--kx-gold-500)" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* Faint full route */}
        <path
          d={path}
          stroke="var(--kx-map-route-alt)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
        />

        {/* Drawing route */}
        <motion.path
          d={path}
          stroke="url(#kx-route-glow)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: prefersReduced ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={
            prefersReduced
              ? { duration: 0 }
              : { duration: 1.9, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.35 }
          }
        />

        {/* Travelling vehicle dot */}
        {!prefersReduced ? (
          <motion.circle
            r={dot}
            fill="var(--kx-gold-500)"
            initial={{ offsetDistance: "0%" }}
            animate={{ offsetDistance: "100%" }}
            transition={{
              duration: 1.9,
              ease: "easeInOut",
              repeat: Infinity,
              repeatDelay: 0.35,
            }}
            style={{ offsetPath: `path("${path}")`, offsetRotate: "0deg" }}
          />
        ) : (
          <circle cx={width - dot} cy={dot} r={dot} fill="var(--kx-gold-500)" />
        )}

        {/* Endpoint markers */}
        <circle
          cx={dot}
          cy={height - dot}
          r={dot * 0.8}
          fill="var(--kx-surface)"
          stroke="var(--kx-forest-600)"
          strokeWidth={stroke * 0.8}
        />
      </svg>

      {currentMessage ? (
        <motion.p
          key={currentMessage}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="type-meta text-center text-ink-secondary"
        >
          {currentMessage}
        </motion.p>
      ) : null}
    </div>
  );
}

/** Full-page loading screen. */
export function PageLoader({
  message = "Preparing your journey",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[60vh] w-full flex-col items-center justify-center gap-6 px-6",
        className,
      )}
    >
      <KoinoniaMark className="size-9 text-forest-700 dark:text-gold-400" />
      <RouteLoader message={message} size="lg" />
    </div>
  );
}

/** Minimal transportation mark — an abstract route between two points. */
export function KoinoniaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <path
        d="M7 25c6.5 0 4.5-9 11-9s4.5-9 11-9"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="7" cy="25" r="3.2" fill="currentColor" />
      <circle
        cx="25"
        cy="7"
        r="3.2"
        stroke="currentColor"
        strokeWidth="2.2"
        fill="none"
      />
    </svg>
  );
}
