"use client";

import { useId, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { transitions } from "@/lib/motion";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  variant?: "underline" | "pill";
  className?: string;
}

/** Underlined or pill tabs with a gliding active indicator. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  variant = "underline",
  className,
}: TabsProps<T>) {
  const layoutId = useId();

  if (variant === "pill") {
    return (
      <div
        role="tablist"
        aria-label={label}
        className={cn(
          "kx-no-scrollbar inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-surface-nested p-1 ring-1 ring-inset ring-line",
          className,
        )}
      >
        {items.map((item) => {
          const selected = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(item.value)}
              className={cn(
                "relative inline-flex h-10 shrink-0 items-center rounded-full px-3.5 text-[0.8125rem] font-medium whitespace-nowrap transition-colors sm:h-8",
                selected ? "text-white dark:text-forest-950" : "text-ink-secondary hover:text-ink",
              )}
            >
              {selected ? (
                <motion.span
                  layoutId={layoutId}
                  className="absolute inset-0 rounded-full bg-forest-800 shadow-sm dark:bg-gold-500"
                  transition={transitions.springSnappy}
                  aria-hidden
                />
              ) : null}
              <span className="relative z-10">
                {item.label}
                {item.count !== undefined ? (
                  <span className="ml-1.5 opacity-65 type-numeric">{item.count}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "kx-no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-line",
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative shrink-0 px-3.5 pt-3 pb-3 text-[0.875rem] font-medium whitespace-nowrap transition-colors sm:pt-1.5",
              selected ? "text-ink" : "text-ink-muted hover:text-ink-secondary",
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span
                className={cn(
                  "ml-2 rounded-full px-1.5 py-0.5 text-[0.6875rem] type-numeric",
                  selected
                    ? "bg-forest-100 text-forest-800 dark:bg-gold-500/18 dark:text-gold-200"
                    : "bg-surface-nested text-ink-muted",
                )}
              >
                {item.count}
              </span>
            ) : null}
            {selected ? (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-forest-700 dark:bg-gold-500"
                transition={transitions.springSnappy}
                aria-hidden
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  active,
  children,
  className,
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (!active) return null;

  return (
    <motion.div
      role="tabpanel"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitions.card}
      className={className}
    >
      {children}
    </motion.div>
  );
}
