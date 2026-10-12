"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

/**
 * "Pin" — the Paid Rides locator character. A map pin with a calm face,
 * used sparingly at the emotional moments: searching, matched, a lost
 * connection, a finished trip. Pure SVG, a few hundred bytes, themed by the
 * brand tokens. Expressions are path morphs, so a mood change reads as one
 * continuous creature rather than a swapped picture.
 */

export type PinMood = "searching" | "found" | "confused" | "happy" | "resting";

const MOUTH: Record<PinMood, string> = {
  searching: "M19 31 Q24 33 29 31",
  found: "M18 30 Q24 36 30 30",
  confused: "M19 32.5 Q24 29.5 29 32",
  happy: "M17.5 29.5 Q24 37 30.5 29.5",
  resting: "M20 32 Q24 33 28 32",
};

const EYE_SCALE: Record<PinMood, number> = { searching: 1, found: 1, confused: 0.82, happy: 0.35, resting: 0.15 };

export function PinCharacter({ mood, size = 64, className, label }: { mood: PinMood; size?: number; className?: string; label?: string }) {
  const { prefersReduced } = useReducedMotionSafe();
  const transition = prefersReduced ? { duration: 0 } : { type: "spring" as const, stiffness: 220, damping: 20 };
  const eyesClass = mood === "searching" && !prefersReduced ? "ride-look" : undefined;

  return (
    <svg
      width={size}
      height={size * 1.18}
      viewBox="0 0 48 57"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(mood === "searching" || mood === "resting" ? "ride-bob" : undefined, className)}
    >
      <ellipse cx="24" cy="54" rx="9" ry="2.2" fill="rgb(16 44 40 / 0.16)" />
      <motion.g animate={{ rotate: mood === "confused" ? -8 : 0 }} transition={transition} style={{ transformOrigin: "24px 48px" }}>
        <path d="M24 51 C24 51 44 33.5 44 21 C44 9.6 35 1.5 24 1.5 S4 9.6 4 21 C4 33.5 24 51 24 51 Z" fill="var(--kx-forest-700)" />
        <path d="M24 4.5 C33.4 4.5 41 11.4 41 21" stroke="rgb(255 255 255 / 0.18)" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="24" cy="23" r="15" fill="var(--kx-warm-white)" />
        <g className={eyesClass}>
          {[18.5, 29.5].map((cx) => (
            <motion.ellipse
              key={cx}
              cx={cx}
              cy={21.5}
              rx={2.1}
              ry={2.6}
              fill="var(--kx-forest-900)"
              className={mood === "searching" || mood === "found" ? "ride-blink" : undefined}
              animate={{ scaleY: EYE_SCALE[mood] }}
              transition={transition}
              style={{ transformOrigin: `${cx}px 21.5px` }}
            />
          ))}
        </g>
        <motion.path d={MOUTH[mood]} animate={{ d: MOUTH[mood] }} transition={transition} stroke="var(--kx-forest-900)" strokeWidth="2" strokeLinecap="round" fill="none" />
        {mood === "happy" || mood === "found" ? (
          <>
            <circle cx="15" cy="27" r="2" fill="var(--kx-gold-300)" opacity="0.7" />
            <circle cx="33" cy="27" r="2" fill="var(--kx-gold-300)" opacity="0.7" />
          </>
        ) : null}
      </motion.g>
      {mood === "confused" ? (
        <motion.text initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} x="39" y="10" fontSize="11" fontWeight="700" fill="var(--kx-gold-600)">
          ?
        </motion.text>
      ) : null}
      {mood === "found" ? (
        <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={transition} style={{ transformOrigin: "40px 9px" }}>
          <circle cx="40" cy="9" r="7" fill="var(--kx-gold-500)" />
          <path d="M36.8 9.2 L39 11.4 L43.4 6.8" stroke="var(--kx-forest-950)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </motion.g>
      ) : null}
    </svg>
  );
}

/** Rating face: the mouth and brows follow the stars, from 1 (let down) to 5 (delighted). */
const RATING_MOUTH = [
  "M17 33 Q24 33 31 33", // 0: not rated yet
  "M17 35 Q24 28.5 31 35",
  "M17.5 34 Q24 30.5 30.5 34",
  "M18 32.5 Q24 32.5 30 32.5",
  "M17.5 31 Q24 36 30.5 31",
  "M16.5 30 Q24 39 31.5 30",
];

export function RatingFace({ stars, size = 76 }: { stars: number; size?: number }) {
  const { prefersReduced } = useReducedMotionSafe();
  const transition = prefersReduced ? { duration: 0 } : { type: "spring" as const, stiffness: 260, damping: 18 };
  const index = Math.max(0, Math.min(5, Math.round(stars)));
  const brow = index === 1 ? 2.4 : index === 2 ? 1.2 : 0;

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <motion.circle cx="24" cy="24" r="22" animate={{ fill: index >= 4 ? "var(--kx-gold-200)" : index === 0 ? "var(--kx-neutral-200)" : "var(--kx-gold-100)" }} transition={transition} />
      <motion.path d="M13.5 15.5 L19 15.5" stroke="var(--kx-forest-900)" strokeWidth="1.6" strokeLinecap="round" animate={{ rotate: brow * 4 }} transition={transition} style={{ transformOrigin: "16px 16px" }} />
      <motion.path d="M34.5 15.5 L29 15.5" stroke="var(--kx-forest-900)" strokeWidth="1.6" strokeLinecap="round" animate={{ rotate: -brow * 4 }} transition={transition} style={{ transformOrigin: "32px 16px" }} />
      <motion.ellipse cx="17.5" cy="21.5" rx="2.1" animate={{ ry: index === 5 ? 1 : 2.5 }} transition={transition} fill="var(--kx-forest-900)" />
      <motion.ellipse cx="30.5" cy="21.5" rx="2.1" animate={{ ry: index === 5 ? 1 : 2.5 }} transition={transition} fill="var(--kx-forest-900)" />
      <motion.path d={RATING_MOUTH[0]} animate={{ d: RATING_MOUTH[index] }} transition={transition} stroke="var(--kx-forest-900)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Search beacon: concentric pulses behind the character while matching. */
export function SearchBeacon({ mood }: { mood: PinMood }) {
  return (
    <div className="relative flex size-36 items-center justify-center" aria-hidden>
      {mood === "searching"
        ? [0, 0.9, 1.8].map((delay) => (
            <span
              key={delay}
              className="ride-pulse-ring absolute inset-0 rounded-full border border-[var(--ride-primary)] bg-[color-mix(in_srgb,var(--ride-primary)_10%,transparent)]"
              style={{ animationDelay: `${delay}s` }}
            />
          ))
        : null}
      <span className="absolute inset-6 rounded-full bg-[var(--surface-secondary)]" />
      <div className="relative">
        <PinCharacter mood={mood} size={58} />
      </div>
    </div>
  );
}
