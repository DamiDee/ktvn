"use client";
import { useLiveQuery } from "./live-queries";
import { extractArray } from "@/lib/trips";
import { routePointIds } from "@/lib/journey-experience";
import type { ApiPoint, ApiRoute } from "@/types/freebus-api";

export function RouteStops({ route, pickup, dropoff, reverse = false }: { route: ApiRoute; pickup?: string | null; dropoff?: string | null; reverse?: boolean }) {
  const points = useLiveQuery<ApiPoint[]>("points");
  const byId = new Map(extractArray<ApiPoint>(points.data).map((point) => [point.id, point]));
  const ids = reverse ? routePointIds(route).reverse() : routePointIds(route);
  return <section className="order-2 mt-6 rounded-2xl border border-line bg-surface-nested p-4" aria-label="Route pickup points and stops">
    <h2 className="text-sm font-semibold text-ink">Your route, stop by stop</h2>
    <p className="mt-1 text-xs text-ink-secondary">Published pickup points and stops, in travel order.</p>
    <ol className="relative ml-3 mt-5 space-y-6 border-l-2 border-line-strong">
      {ids.map((id, index) => {
        const point = byId.get(id);
        const isHighlight = id === pickup || id === dropoff;
        return (
          <li key={`${id}-${index}`} className="relative pl-6">
            <span
              className={`absolute -left-[13px] top-0 flex size-6 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                isHighlight
                  ? "border-gold-500 bg-gold-500/20 text-gold-700 dark:text-gold-300"
                  : "border-line-strong bg-surface text-ink-muted"
              }`}
              aria-hidden
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <p
                className={`text-[0.65rem] font-bold uppercase tracking-wider ${
                  isHighlight ? "text-gold-700 dark:text-gold-400" : "text-ink-muted"
                }`}
              >
                {id === pickup
                  ? "Your pickup"
                  : id === dropoff
                    ? "Your drop-off"
                    : index === 0
                      ? "Route start"
                      : index === ids.length - 1
                        ? "Route end"
                        : "Stop"}
              </p>
              <p
                className={`mt-0.5 break-words text-sm ${
                  isHighlight ? "font-semibold text-ink" : "font-medium text-ink-secondary"
                }`}
              >
                {point?.name ?? (points.isPending ? "Loading stop…" : "Stop details unavailable")}
              </p>
              {point?.landmark ? (
                <p className="mt-0.5 break-words text-xs text-ink-muted">{point.landmark}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
    {points.error ? <button onClick={() => void points.refetch()} className="mt-3 text-sm text-danger-600 underline">Could not load stops. Retry</button> : null}
  </section>;
}
