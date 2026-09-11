"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { revealVariants, staggerContainer, viewportOnce } from "@/lib/motion";

export function Section({
  id,
  children,
  className,
  tone = "default",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  tone?: "default" | "subtle" | "dark";
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative scroll-mt-24 px-4 py-12 sm:px-6 sm:py-18",
        tone === "subtle" && "bg-canvas-subtle",
        tone === "dark" && "bg-forest-900 text-ink-inverse",
        className,
      )}
    >
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "default",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  tone?: "default" | "inverse";
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerContainer(0.08)}
      initial="initial"
      whileInView="animate"
      viewport={viewportOnce}
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow ? (
        <motion.p
          variants={revealVariants}
          className={cn(
            "type-micro mb-4",
            tone === "inverse" ? "text-gold-400" : "text-gold-700 dark:text-gold-400",
          )}
        >
          {eyebrow}
        </motion.p>
      ) : null}

      <motion.h2
        variants={revealVariants}
        className={cn(
          "type-page-title",
          tone === "inverse" ? "text-white" : "text-ink",
        )}
      >
        {title}
      </motion.h2>

      {description ? (
        <motion.p
          variants={revealVariants}
          className={cn(
            "type-body-lg mt-4",
            tone === "inverse" ? "text-white/70" : "text-ink-secondary",
          )}
        >
          {description}
        </motion.p>
      ) : null}
    </motion.div>
  );
}

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewportOnce}
      transition={{ duration: 0.62, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
