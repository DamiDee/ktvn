"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

/**
 * Abuja slideshow for the sign-in and sign-up visual panel.
 *
 * Original artwork crossfades with a brief, gentle reveal; story-style
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
    src: "/images/abuja/krides-boulevard.webp",
    alt: "Original K-Rides artwork: a pearl-white sedan on an Abuja-inspired boulevard, with a granite rock and skyline beyond.",
    place: "The city, reimagined",
    line: "Abuja-inspired journeys.",
    focus: "50% 55%",
  },
  {
    src: "/images/abuja/krides-city-gate.webp",
    alt: "Original K-Rides artwork: a graphite sedan approaching architecture inspired by Abuja City Gate.",
    place: "A new arrival",
    line: "Inspired by Abuja City Gate.",
    focus: "50% 55%",
  },
  {
    src: "/images/abuja/krides-welcome.webp",
    alt: "Original K-Rides artwork: a smiling Nigerian driver welcomes a passenger beside a sedan in an Abuja-inspired setting.",
    place: "People make the journey",
    line: "A warmer welcome, every time.",
    focus: "50% 55%",
  },
];

const SLIDE_MS = 8500;

export function AuthCarousel({
  slides = ABUJA_SLIDES,
  index,
  onIndexChange,
  paused = false,
}: {
  slides?: AuthSlide[];
  index: number;
  onIndexChange: (index: number) => void;
  paused?: boolean;
}) {
  const { prefersReduced } = useReducedMotionSafe();
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
      aria-label="Original K-Rides artwork inspired by Abuja"
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
            initial={{ scale: prefersReduced ? 1 : 1.025 }}
            animate={{ scale: 1 }}
            transition={{ duration: prefersReduced ? 0 : 1.2, ease: "easeOut" }}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              loading={index === 0 ? "eager" : "lazy"}
              sizes="(max-width: 1023px) 100vw, 50vw"
              className="object-cover"
              style={{ objectPosition: slide.focus }}
            />
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Story-style progress, top of the panel. */}
      <div className="absolute inset-x-0 top-0 z-20 flex gap-1.5 px-[clamp(20px,3vw,48px)]" role="group" aria-label="Choose an artwork">
        {slides.map((item, slideIndex) => (
          <button
            key={item.src}
            type="button"
            aria-pressed={slideIndex === index}
            aria-label={`Show ${item.place}`}
            onClick={() => go(slideIndex)}
            className="relative flex h-11 flex-1 items-center rounded-lg"
          >
            <span className="relative h-1 w-full overflow-hidden rounded-full bg-white/30" aria-hidden>
              <span
                key={`${index}-${playing}`}
                className="absolute inset-y-0 left-0 rounded-full bg-white"
                style={{
                  width: slideIndex < index ? "100%" : slideIndex === index && !playing ? "100%" : "0%",
                  animation: slideIndex === index && playing ? `auth-slide-progress ${SLIDE_MS}ms linear forwards` : undefined,
                }}
              />
            </span>
          </button>
        ))}
      </div>

    </div>
  );
}
