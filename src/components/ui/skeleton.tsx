import { cn } from "@/lib/cn";

/**
 * Skeletons preserve the shape of the content they stand in for, so the page
 * doesn't reflow when data lands.
 */

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("kx-skeleton", className)} {...props} aria-hidden />;
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-3.5 rounded-full"
          style={{ width: index === lines - 1 ? "62%" : "100%" }}
        />
      ))}
    </div>
  );
}

/** Matches the shape of a DriverCard. */
export function DriverCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[var(--kx-radius-lg)] border border-line bg-surface p-5",
        className,
      )}
      aria-hidden
    >
      <div className="flex items-center gap-3.5">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32 rounded-full" />
          <Skeleton className="h-3 w-20 rounded-full" />
        </div>
        <Skeleton className="h-8 w-16 rounded-full" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-2.5 w-12 rounded-full" />
            <Skeleton className="h-3.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Matches the shape of a RideCard row. */
export function RideCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[var(--kx-radius-lg)] border border-line bg-surface p-5",
        className,
      )}
      aria-hidden
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="h-4 w-48 rounded-full" />
          <Skeleton className="h-3 w-36 rounded-full" />
        </div>
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function StatsCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[var(--kx-radius-lg)] border border-line bg-surface p-5",
        className,
      )}
      aria-hidden
    >
      <Skeleton className="h-2.5 w-20 rounded-full" />
      <Skeleton className="mt-3 h-8 w-24 rounded-lg" />
      <Skeleton className="mt-3 h-2.5 w-16 rounded-full" />
    </div>
  );
}

export function ListSkeleton({
  rows = 4,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <RideCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function TableSkeleton({
  rows = 6,
  columns = 5,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2.5", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid items-center gap-4 rounded-[var(--kx-radius-md)] px-4 py-3.5"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((__, colIndex) => (
            <Skeleton
              key={colIndex}
              className="h-3.5 rounded-full"
              style={{ width: colIndex === 0 ? "80%" : "60%" }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
