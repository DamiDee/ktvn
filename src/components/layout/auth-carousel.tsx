"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

/**
 * Abuja slideshow for the sign-in and sign-up visual panel.
 *
 * Slides crossfade with a slow drift (a gentle Ken Burns), story-style
 * progress bars show where you are and are clickable, and autoplay pauses
 * on hover, keyboard focus, a hidden tab, or reduced motion.
 */

export interface AuthSlide {
  src: string;
  alt: string;
  place: string;
  line: string;
  /** Where the eye should land when the photo is cropped. */
  focus: string;
}

export const ABUJA_SLIDES: AuthSlide[] = [
  {
    src: "/images/abuja/zuma-rock-expressway.jpg",
    alt: "Traffic flowing along a wide Abuja expressway towards the city towers, with Zuma Rock rising behind them.",
    place: "Zuma Rock & the expressway",
    line: "Wide roads, a city that keeps moving.",
    focus: "50% 38%",
  },
  {
    src: "/images/abuja/city-gate.jpg",
    alt: "The white Abuja City Gate arch under a clear sky, reading “You are welcome”.",
    place: "Abuja City Gate",
    line: "Every journey starts with a welcome.",
    focus: "50% 42%",
  },
  {
    src: "/images/abuja/city-gate-aerial.jpg",
    alt: "An aerial view of the City Gate interchange with green fields and the city spreading to the horizon.",
    place: "City Gate interchange",
    line: "From the outskirts to the centre, together.",
    focus: "70% 62%",
  },
];

const SLIDE_MS = 6500;

export function AuthCarousel({
  slides = ABUJA_SLIDES,
  index,
  onIndexChange,
}: {
  slides?: AuthSlide[];
  index: number;
  onIndexChange: (index: number) => void;
}) {
  const { prefersReduced } = useReducedMotionSafe();
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const playing = !paused && !hidden && !prefersReduced && slides.length > 1;

  const go = useCallback((next: number) => onIndexChange((next + slides.length) % slides.length), [slides.length, onIndexChange]);

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => go(index + 1), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [playing, index, go]);

  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const slide = slides[index];

  return (
    <div
      className="absolute inset-0"
      role="region"
      aria-roledescription="carousel"
      aria-label="Places in Abuja"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={slide.src}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReduced ? 0 : 1.2, ease: [0.32, 0.72, 0, 1] }}
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${slides.length}: ${slide.place}`}
        >
          <motion.div
            className="absolute inset-0"
            initial={{ scale: prefersReduced ? 1 : 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: prefersReduced ? 0 : (SLIDE_MS + 1200) / 1000, ease: "linear" }}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              priority={index === 0}
              sizes="(max-width: 1023px) 100vw, 50vw"
              quality={90}
              className="object-cover"
              style={{ objectPosition: slide.focus }}
            />
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Story-style progress, top of the panel. */}
      <div className="absolute inset-x-0 top-0 z-20 flex gap-1.5 px-[clamp(20px,3vw,48px)] pt-4 lg:pt-5" role="tablist" aria-label="Choose a photo">
        {slides.map((item, slideIndex) => (
          <button
            key={item.src}
            type="button"
            role="tab"
            aria-selected={slideIndex === index}
            aria-label={`Show ${item.place}`}
            onClick={() => go(slideIndex)}
            className="kx-tap relative h-1 flex-1 overflow-hidden rounded-full bg-white/25"
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-white"
              style={{
                width: slideIndex < index ? "100%" : slideIndex === index && !playing ? "100%" : "0%",
                animation: slideIndex === index && playing ? `auth-slide-progress ${SLIDE_MS}ms linear forwards` : undefined,
              }}
            />
          </button>
        ))}
      </div>

    </div>
  );
}
