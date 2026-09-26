"use client";

import { GripVertical, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ApiPoint } from "@/types/freebus-api";

/**
 * Intermediate stops, in the order the bus will call at them.
 *
 * Order is what the road-distance estimate follows, so it is shown and edited
 * explicitly rather than inferred from a checkbox list's DOM order.
 */
export function StopPicker({
  points,
  start,
  end,
  stops,
  onChange,
}: {
  points: ApiPoint[];
  start: string;
  end: string;
  stops: string[];
  onChange: (stops: string[]) => void;
}) {
  const available = points.filter((p) => p.id !== start && p.id !== end);
  const byId = new Map(points.map((p) => [p.id, p]));
  const chosen = stops.filter((id) => byId.has(id) && id !== start && id !== end);

  const move = (index: number, delta: number) => {
    const next = [...chosen];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <fieldset className="rounded-[var(--kx-radius-lg)] border border-line p-3">
      <legend className="type-micro px-1 text-ink-muted">Stops along the way (optional)</legend>

      {chosen.length > 0 ? (
        <ol className="mb-3 space-y-1.5">
          {chosen.map((id, index) => (
            <li
              key={id}
              className="flex items-center gap-2 rounded-[var(--kx-radius-md)] bg-surface-nested px-2.5 py-2"
            >
              <GripVertical className="size-4 shrink-0 text-ink-muted" aria-hidden />
              <span className="type-numeric shrink-0 text-[0.75rem] font-semibold text-ink-muted">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink">
                {byId.get(id)?.name}
              </span>
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move ${byId.get(id)?.name} earlier`}
                className="kx-tap rounded px-1 text-ink-muted hover:text-ink disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === chosen.length - 1}
                aria-label={`Move ${byId.get(id)?.name} later`}
                className="kx-tap rounded px-1 text-ink-muted hover:text-ink disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onChange(chosen.filter((value) => value !== id))}
                aria-label={`Remove ${byId.get(id)?.name}`}
                className="kx-tap rounded p-0.5 text-ink-muted hover:text-danger-600"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      {available.length === 0 ? (
        <p className="type-meta text-ink-muted">
          Add more boarding points to be able to call at them along the way.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {available.map((point) => {
            const picked = chosen.includes(point.id);
            return (
              <button
                key={point.id}
                type="button"
                onClick={() =>
                  onChange(picked ? chosen.filter((id) => id !== point.id) : [...chosen, point.id])
                }
                aria-pressed={picked}
                className={cn(
                  "kx-tap rounded-full border px-3 py-1 text-[0.8125rem] transition-colors",
                  picked
                    ? "border-forest-800 bg-forest-800 text-white dark:border-gold-400 dark:bg-gold-400 dark:text-forest-950"
                    : "border-line bg-surface text-ink-secondary hover:border-line-strong hover:text-ink",
                )}
              >
                {point.name}
              </button>
            );
          })}
        </div>
      )}

      <p className="type-meta mt-2.5 text-ink-muted">
        Tap a point to add it. The order above is the order the bus calls at them, and it is the
        path the distance is measured along.
      </p>
    </fieldset>
  );
}
