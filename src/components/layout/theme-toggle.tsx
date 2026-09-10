"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import { useMounted } from "@/hooks/use-media-query";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

/** Compact three-way theme control. */
export function ThemeToggle({
  className,
  tone = "default",
}: {
  className?: string;
  tone?: "default" | "inverse";
}) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full p-0.5",
        tone === "inverse"
          ? "bg-white/10 ring-1 ring-inset ring-white/15"
          : "bg-surface-nested ring-1 ring-inset ring-line",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = mounted && theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${option.label} theme`}
            onClick={() => setTheme(option.value)}
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-full transition-colors duration-[165ms] sm:size-7",
              selected
                ? tone === "inverse"
                  ? "bg-white/20 text-white"
                  : "bg-surface text-ink shadow-xs"
                : tone === "inverse"
                  ? "text-white/60 hover:text-white"
                  : "text-ink-muted hover:text-ink",
            )}
          >
            <Icon className="size-3.5" strokeWidth={1.9} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
