"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { viewportOnce } from "@/lib/motion";

export type TimelineNodeState = "COMPLETE" | "ACTIVE" | "PENDING" | "BLOCKED";

export interface TimelineItem {
  id: string;
  label: string;
  description?: ReactNode;
  meta?: ReactNode;
  state: TimelineNodeState;
}

export interface TimelineProps {
  items: TimelineItem[];
  orientation?: "vertical" | "horizontal";
  className?: string;
}

const NODE_STYLES: Record<TimelineNodeState, string> = {
  COMPLETE: "border-forest-600 bg-forest-600 text-white dark:border-gold-500 dark:bg-gold-500 dark:text-forest-950",
  ACTIVE: "border-gold-500 bg-surface text-gold-600 dark:text-gold-400",
  PENDING: "border-line-strong bg-surface text-ink-muted",
  BLOCKED: "border-danger-500/50 bg-surface text-danger-500",
};

export function Timeline({
  items,
  orientation = "vertical",
  className,
}: TimelineProps) {
  if (orientation === "horizontal") {
    return (
      <ol className={cn("flex w-full items-start", className)}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={item.id} className="relative flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <TimelineNode item={item} index={index} />
                {!isLast ? (
                  <span
                    className={cn(
                      "mx-1 h-0.5 flex-1 rounded-full",
                      item.state === "COMPLETE"
                        ? "bg-forest-500 dark:bg-gold-500"
                        : "bg-line-strong",
                    )}
                    aria-hidden
                  />
                ) : null}
              </div>
              <p
                className={cn(
                  "mt-2.5 px-1 text-center text-[0.75rem] font-medium",
                  item.state === "PENDING" ? "text-ink-muted" : "text-ink",
                )}
              >
                {item.label}
              </p>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol className={cn("relative space-y-0", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <motion.li
            key={item.id}
            initial={{ opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={viewportOnce}
            transition={{ duration: 0.34, delay: index * 0.05 }}
            className="relative flex gap-4 pb-6 last:pb-0"
          >
            <div className="flex flex-col items-center">
              <TimelineNode item={item} index={index} />
              {!isLast ? (
                <span
                  className={cn(
                    "mt-1 w-0.5 flex-1 rounded-full",
                    item.state === "COMPLETE"
                      ? "bg-forest-500/60 dark:bg-gold-500/50"
                      : "bg-line-strong",
                  )}
                  aria-hidden
                />
              ) : null}
            </div>

            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p
                  className={cn(
                    "text-[0.9375rem] font-medium",
                    item.state === "PENDING" ? "text-ink-muted" : "text-ink",
                  )}
                >
                  {item.label}
                </p>
                {item.meta ? (
                  <span className="type-meta text-ink-muted">{item.meta}</span>
                ) : null}
              </div>
              {item.description ? (
                <p className="type-meta mt-1 text-ink-secondary">
                  {item.description}
                </p>
              ) : null}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

function TimelineNode({ item, index }: { item: TimelineItem; index: number }) {
  return (
    <span
      className={cn(
        "relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[0.6875rem] font-semibold",
        NODE_STYLES[item.state],
      )}
    >
      {item.state === "COMPLETE" ? (
        <Check className="size-3.5" strokeWidth={3} aria-hidden />
      ) : item.state === "ACTIVE" ? (
        <>
          <span
            className="absolute inset-0 rounded-full bg-gold-500/25"
            style={{ animation: "kx-pulse-ring 2.4s ease-out infinite" }}
            aria-hidden
          />
          <span className="size-2 rounded-full bg-gold-500" aria-hidden />
        </>
      ) : (
        <span aria-hidden>{index + 1}</span>
      )}
      <span className="sr-only">
        {item.state === "COMPLETE"
          ? "Completed"
          : item.state === "ACTIVE"
            ? "In progress"
            : "Not started"}
      </span>
    </span>
  );
}
