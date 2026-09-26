"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";
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
  /**
   * A cluster of buttons. On a phone these get their own full-width row at the
   * foot of the card: squeezed beside the headline they cannot wrap, and push
   * the page sideways.
   */
  actions?: boolean;
  /** Hidden below this breakpoint on desktop tables. */
  hideBelow?: "lg" | "xl";
  /** Opt this column into sorting by returning the value to order on. */
  sortBy?: (row: T) => string | number;
}

export interface SortState {
  id: string;
  direction: "asc" | "desc";
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
  /** Current sort, for columns that declare `sortBy`. */
  sort?: SortState | null;
  onSortChange?: (sort: SortState) => void;
  /** Keeps the header visible while a long table scrolls. */
  stickyHeader?: boolean;
  /** Caps the desktop scroll area so the page itself never grows unbounded. */
  maxHeight?: number;
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
  sort,
  onSortChange,
  stickyHeader = false,
  maxHeight,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  const primary = columns.find((column) => column.primary) ?? columns[0];
  const secondary = columns.filter((column) => column.secondary);
  const metas = columns.filter((column) => column.meta);
  const trailing = columns.filter(
    (column) => column.align === "end" && !column.meta && !column.secondary && !column.actions,
  );
  const actionColumns = columns.filter((column) => column.actions);

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
                "rounded-[var(--kx-radius-lg)] border p-4 shadow-sm",
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

                <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
                  {trailing.map((column) => (
                    <div key={column.id} className="min-w-0">
                      {column.cell(row)}
                    </div>
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
                      <dd className="mt-1 break-words">{column.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {actionColumns.length > 0 ? (
                <div className="mt-3 flex min-w-0 flex-wrap items-center gap-1.5 border-t border-line pt-3">
                  {actionColumns.map((column) => (
                    <div key={column.id} className="min-w-0 [&>div]:justify-start">
                      {column.cell(row)}
                    </div>
                  ))}
                </div>
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
      <div
        className="hidden min-w-0 overflow-auto lg:block"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className="w-full border-collapse">
          <caption className="sr-only">{caption}</caption>
          <thead className={cn(stickyHeader && "sticky top-0 z-10 bg-surface")}>
            <tr className="border-b border-line">
              {columns.map((column) => {
                const sortable = Boolean(column.sortBy && onSortChange);
                const active = sort?.id === column.id;
                const Arrow = !active ? ChevronsUpDown : sort?.direction === "asc" ? ChevronUp : ChevronDown;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={
                      !sortable ? undefined : active ? (sort?.direction === "asc" ? "ascending" : "descending") : "none"
                    }
                    className={cn(
                      "px-5 py-4 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink-secondary",
                      column.align === "end" ? "text-right" : "text-left",
                      column.hideBelow === "xl" && "hidden xl:table-cell",
                      stickyHeader && "border-b border-line bg-surface-nested",
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() =>
                          onSortChange!({
                            id: column.id,
                            direction: active && sort?.direction === "asc" ? "desc" : "asc",
                          })
                        }
                        className={cn(
                          "-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase tracking-[inherit] transition-colors hover:text-ink",
                          active && "text-ink",
                          column.align === "end" && "flex-row-reverse",
                        )}
                      >
                        {column.header}
                        <Arrow className="size-3.5 opacity-70" aria-hidden />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
              {interactive ? <th className={cn("w-8", stickyHeader && "bg-surface")} /> : null}
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
                    "group border-b border-line/70 transition-colors last:border-0",
                    critical
                      ? "bg-sos-50/60 dark:bg-sos-500/8"
                      : "even:bg-surface-nested/25 hover:bg-gold-500/5",
                    interactive && "cursor-pointer",
                  )}
                >
                  {columns.map((column, index) => (
                    <td
                      key={column.id}
                      className={cn(
                        "px-5 py-5 align-middle text-sm leading-relaxed",
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
