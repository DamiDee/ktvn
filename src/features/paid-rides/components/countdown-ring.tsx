"use client";

import { cn } from "@/lib/cn";

/**
 * Circular countdown for offers. Progress is drawn from real time left, so a
 * request restored after a reload shows the true remainder.
 */
export function CountdownRing({ secondsLeft, totalSeconds, size = 64, className }: { secondsLeft: number; totalSeconds: number; size?: number; className?: string }) {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = totalSeconds > 0 ? Math.max(0, Math.min(1, secondsLeft / totalSeconds)) : 0;
  const urgent = secondsLeft <= 5;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${secondsLeft} seconds to respond`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-secondary)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={urgent ? "var(--ride-sos)" : "var(--ride-primary)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 200ms" }}
        />
      </svg>
      <span aria-hidden className={cn("ride-num absolute text-[1.25rem] font-semibold", urgent && "text-[var(--ride-sos)]")}>
        {secondsLeft}
      </span>
    </div>
  );
}
