import { cn } from "@/lib/cn";

export function Brand({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap", inverse ? "text-white" : "text-ink")}>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", inverse ? "bg-white/15 ring-1 ring-white/25 backdrop-blur-md" : "bg-forest-900 text-white")}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4v16M19 4l-8 8 8 8M11 12H5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /><circle cx="19" cy="4" r="2" fill="currentColor" /></svg>
      </span>
      {!compact && <span className="text-xl font-semibold tracking-[-0.065em]">K-Rides<span className="text-[var(--premium-accent,#9cb9ff)]">.</span></span>}
    </span>
  );
}
