import { cn } from "@/lib/cn";

/**
 * Non-interactive brand atmosphere. The asymmetric forms echo a drop of
 * water and are deliberately kept away from controls and reading surfaces.
 */
export function LiquidBackdrop({
  className,
  inverse = false,
}: {
  className?: string;
  inverse?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <span
        className={cn(
          "kx-liquid-drop kx-liquid-drop-a absolute -top-24 -right-16 size-72 sm:size-96",
          inverse ? "bg-gold-400/12" : "bg-gold-300/24 dark:bg-gold-400/10",
        )}
      />
      <span
        className={cn(
          "kx-liquid-drop kx-liquid-drop-b absolute -bottom-28 -left-24 size-80 sm:size-[28rem]",
          inverse ? "bg-white/6" : "bg-forest-200/35 dark:bg-forest-500/12",
        )}
      />
      <span
        className={cn(
          "kx-liquid-drop kx-liquid-drop-c absolute top-[42%] right-[18%] size-24",
          inverse ? "bg-lilac-400/10" : "bg-lilac-300/16 dark:bg-lilac-400/8",
        )}
      />
    </div>
  );
}
