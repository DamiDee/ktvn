"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * One list, two shapes.
 *
 * On large screens this is a real table. On phones a table is the wrong
 * container — sideways scrolling hides columns and makes rows unreadable — so
 * the same rows render as cards, with each cell labelled by its column.
 *
 * Columns opt into the card view via `primary`, `secondary` or `meta`, so a
 * row stays legible at 360px without duplicating any markup.
 */

export interface DataColumn<T> {
  id: string;
  header: string;
  /** Desktop cell. */
  cell: (row: T) => ReactNode;
  /** Card headline. Exactly one column should set this. */
  primary?: boolean;
  /** Rendered under the headline on cards. */
  secondary?: boolean;
  /** Rendered as a labelled chip row at the foot of the card. */
  meta?: boolean;
  /** Right-aligned on desktop, top-right on cards. */
  align?: "start" | "end";
  /** Hidden below this breakpoint on desktop tables. */
  hideBelow?: "lg" | "xl";
}

export interface DataTableProps<T> {
  rows: T[];
  columns: DataColumn<T>[];
  rowKey: (row: T) => string;
  /** Makes the whole row a link. */
  rowHref?: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Highlights a row that needs attention, e.g. an active SOS. */
  rowTone?: (row: T) => "default" | "critical";
  caption: string;
  empty?: ReactNode;
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  rowHref,
  onRowClick,
  rowTone,
  caption,
  empty,
  className,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  const primary = columns.find((column) => column.primary) ?? columns[0];
  const secondary = columns.filter((column) => column.secondary);
  const metas = columns.filter((column) => column.meta);
  const trailing = columns.filter(
    (column) => column.align === "end" && !column.meta && !column.secondary,
  );

  const interactive = Boolean(rowHref || onRowClick);

  return (
    <div className={className}>
      {/* --- Cards: phones and small tablets ----------------------------- */}
      <ul className="space-y-2.5 lg:hidden" aria-label={caption}>
        {rows.map((row) => {
          const critical = rowTone?.(row) === "critical";
          const href = rowHref?.(row);

          const content = (
            <div
              className={cn(
                "rounded-[var(--kx-radius-lg)] border p-4",
                critical
                  ? "border-sos-500/35 bg-sos-50/60 dark:bg-sos-500/8"
                  : "border-line bg-surface",
                interactive && "transition-colors active:bg-surface-nested",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {primary.cell(row)}
                  {secondary.map((column) => (
                    <div key={column.id} className="mt-1">
                      {column.cell(row)}
                    </div>
                  ))}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {trailing.map((column) => (
                    <div key={column.id}>{column.cell(row)}</div>
                  ))}
                  {interactive ? (
                    <ChevronRight
                      className="size-4 text-ink-muted"
                      strokeWidth={2}
                      aria-hidden
                    />
                  ) : null}
                </div>
              </div>

              {metas.length > 0 ? (
                <dl className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
                  {metas.map((column) => (
                    <div key={column.id} className="min-w-0">
                      <dt className="type-micro text-ink-muted">
                        {column.header}
                      </dt>
                      <dd className="mt-1">{column.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          );

          return (
            <li key={rowKey(row)}>
              {href ? (
                <Link href={href} className="block">
                  {content}
                </Link>
              ) : onRowClick ? (
                <button
                  type="button"
                  onClick={() => onRowClick(row)}
                  className="block w-full text-left"
                >
                  {content}
                </button>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>

      {/* --- Table: large screens ---------------------------------------- */}
      {/*
        The table keeps its own scroll container: in a narrow desktop column
        the cells have a real minimum width, and it is the table that should
        scroll, never the page.
      */}
      <div className="hidden min-w-0 overflow-x-auto lg:block">
        <table className="w-full border-collapse">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line">
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={cn(
                    "type-micro px-3 py-2.5 text-ink-muted",
                    column.align === "end" ? "text-right" : "text-left",
                    column.hideBelow === "xl" && "hidden xl:table-cell",
                  )}
                >
                  {column.header}
                </th>
              ))}
              {interactive ? <th className="w-8" /> : null}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const critical = rowTone?.(row) === "critical";
              const href = rowHref?.(row);

              return (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-b border-line transition-colors last:border-0",
                    critical
                      ? "bg-sos-50/60 dark:bg-sos-500/8"
                      : "hover:bg-surface-nested",
                    interactive && "cursor-pointer",
                  )}
                >
                  {columns.map((column, index) => (
                    <td
                      key={column.id}
                      className={cn(
                        "px-3 py-3.5 align-middle",
                        column.align === "end" && "text-right",
                        column.hideBelow === "xl" && "hidden xl:table-cell",
                      )}
                    >
                      {/* The first cell carries the link, so the whole row is
                          reachable by keyboard without nesting interactives. */}
                      {index === 0 && href ? (
                        <Link href={href} className="block">
                          {column.cell(row)}
                        </Link>
                      ) : (
                        column.cell(row)
                      )}
                    </td>
                  ))}
                  {interactive ? (
                    <td className="px-3 py-3.5 text-right">
                      <ChevronRight
                        className="inline size-4 text-ink-muted"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
