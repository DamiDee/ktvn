"use client";
import { useLiveQuery } from "./live-queries";
import { extractArray } from "@/lib/trips";
import { routePointIds } from "@/lib/journey-experience";
import type { ApiPoint, ApiRoute } from "@/types/freebus-api";

export function RouteStops({ route }: { route: ApiRoute }) {
  const points = useLiveQuery<ApiPoint[]>("points");
  const byId = new Map(extractArray<ApiPoint>(points.data).map((point) => [point.id, point]));
  const ids = routePointIds(route);
  return <section className="order-2 mt-6 rounded-2xl border border-line bg-surface-nested p-4" aria-label="Route pickup points and stops">
    <h2 className="text-sm font-semibold text-ink">Your route, stop by stop</h2>
    <p className="mt-1 text-xs text-ink-secondary">Published pickup points and stops, in travel order.</p>
    <ol className="mt-4 space-y-3">{ids.map((id, index) => {
      const point = byId.get(id);
      return <li key={`${id}-${index}`} className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/10 text-xs text-ink" aria-hidden>{index + 1}</span><div className="min-w-0"><p className="text-[.65rem] font-medium uppercase tracking-wide text-ink-secondary">{index === 0 ? "Starting pickup point" : index === ids.length - 1 ? "Destination" : "On-route stop"}</p><p className="mt-0.5 break-words text-sm font-medium text-ink">{point?.name ?? (points.isPending ? "Loading stop…" : "Stop details unavailable")}</p>{point?.landmark ? <p className="mt-0.5 break-words text-xs text-ink-secondary">{point.landmark}</p> : null}</div></li>;
    })}</ol>
    {points.error ? <button onClick={() => void points.refetch()} className="mt-3 text-sm text-danger-600 underline">Could not load stops. Retry</button> : null}
  </section>;
}
