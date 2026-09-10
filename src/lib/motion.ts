import type { Transition, Variants } from "motion/react";
import { DURATION, EASE, SPRING } from "@/constants/design-tokens";

/**
 * Shared motion presets. Every animated surface in the product should pull
 * from here so timing stays consistent and reduced-motion is handled in one
 * place (see `useReducedMotionSafe`).
 */

export const transitions = {
  quick: { duration: DURATION.quick, ease: EASE.standard } as Transition,
  card: { duration: DURATION.card, ease: EASE.standard } as Transition,
  page: { duration: DURATION.page, ease: EASE.out } as Transition,
  springSnappy: SPRING.snappy as Transition,
  springGentle: SPRING.gentle as Transition,
  springSoft: SPRING.soft as Transition,
  sheet: SPRING.sheet as Transition,
};

/** Page-level enter/exit: fade + small vertical shift. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: transitions.page },
  exit: { opacity: 0, y: -6, transition: transitions.quick },
};

/** Card entrance used for dashboard grids and lists. */
export const cardVariants: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: transitions.card },
  exit: { opacity: 0, y: 8, transition: transitions.quick },
};

/** Staggered container for lists of cards. */
export function staggerContainer(stagger = 0.055, delay = 0): Variants {
  return {
    initial: {},
    animate: {
      transition: { staggerChildren: stagger, delayChildren: delay },
    },
  };
}

/** Scroll-reveal for marketing sections. */
export const revealVariants: Variants = {
  initial: { opacity: 0, y: 22 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.62, ease: EASE.out },
  },
};

/** Bottom sheet / modal on mobile. */
export const sheetVariants: Variants = {
  initial: { y: "100%" },
  animate: { y: 0, transition: transitions.sheet },
  exit: { y: "100%", transition: { duration: DURATION.card, ease: EASE.inOut } },
};

/** Centred modal on desktop. */
export const dialogVariants: Variants = {
  initial: { opacity: 0, scale: 0.965, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: transitions.springGentle },
  exit: { opacity: 0, scale: 0.98, y: 4, transition: transitions.quick },
};

export const backdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: transitions.card },
  exit: { opacity: 0, transition: transitions.quick },
};

/** Toast entrance. */
export const toastVariants: Variants = {
  initial: { opacity: 0, y: 16, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: transitions.springSnappy },
  exit: { opacity: 0, y: 8, scale: 0.98, transition: transitions.quick },
};

/** Collapse/expand used by the fare panel when switching tracks. */
export const collapseVariants: Variants = {
  initial: { height: 0, opacity: 0 },
  animate: {
    height: "auto",
    opacity: 1,
    transition: { height: transitions.card, opacity: { duration: 0.2, delay: 0.05 } },
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: { height: transitions.card, opacity: { duration: 0.12 } },
  },
};

/** Standard viewport config for scroll reveals. */
export const viewportOnce = { once: true, amount: 0.28 } as const;
