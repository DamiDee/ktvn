"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { DataTable, type DataColumn, type SortState } from "@/components/ui/data-table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const PAGE_SIZES = [10, 25, 50];

export interface RecordsTableProps<T> {
  rows: T[];
  columns: DataColumn<T>[];
  rowKey: (row: T) => string;
  /** Accessible name, and the caption screen readers announce. */
  caption: string;
  /** The text a search matches against. Omit to hide the search field. */
  searchIn?: (row: T) => string;
  searchPlaceholder?: string;
  /** Sits at the far right of the toolbar — the primary action for this list. */
  action?: ReactNode;
  /** Extra controls (filters) rendered between search and the action. */
  filters?: ReactNode;
  initialSort?: SortState;
  pageSize?: number;
  /** Disable client paging when the screen already has a server-side pager. */
  paginate?: boolean;
  /** Shown when there are no records at all, as opposed to none matching. */
  empty?: ReactNode;
  rowTone?: (row: T) => "default" | "critical";
  rowHref?: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** A live count is reassuring on a list that grows; hide it for tiny ones. */
  showCount?: boolean;
  className?: string;
}

/**
 * A list built for volume.
 *
 * Search, sort and paging happen over the rows already in hand, so the table
 * stays responsive as a season's worth of schedules, logs and stops accumulate.
 * Below `lg` the underlying table becomes cards, so the same list is readable
 * on a phone without sideways scrolling.
 */
export function RecordsTable<T>({
  rows,
  columns,
  rowKey,
  caption,
  searchIn,
  searchPlaceholder = "Search",
  action,
  filters,
  initialSort,
  pageSize: initialPageSize = 10,
  paginate = true,
  empty,
  rowTone,
  rowHref,
  onRowClick,
  showCount = true,
  className,
}: RecordsTableProps<T>) {
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState<SortState | null>(initialSort ?? null);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);
  const query = useDebouncedValue(term, 200);

  const matched = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || !searchIn) return rows;
    return rows.filter((row) => searchIn(row).toLowerCase().includes(needle));
  }, [rows, query, searchIn]);

  const ordered = useMemo(() => {
    const column = sort && columns.find((c) => c.id === sort.id);
    if (!column?.sortBy) return matched;
    const read = column.sortBy;
    const factor = sort?.direction === "desc" ? -1 : 1;
    return [...matched].sort((a, b) => {
      const left = read(a);
      const right = read(b);
      if (typeof left === "number" && typeof right === "number") return (left - right) * factor;
      return String(left).localeCompare(String(right), undefined, { numeric: true }) * factor;
    });
  }, [matched, sort, columns]);

  // A filter that shortens the list must never strand the reader on page 9.
  const pageCount = Math.max(1, Math.ceil(ordered.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = paginate ? (current - 1) * pageSize : 0;
  const visible = paginate ? ordered.slice(start, start + pageSize) : ordered;

  const changeSort = (next: SortState) => {
    setSort(next);
    setPage(1);
  };

  if (rows.length === 0 && empty)
    return (
      <div className={className}>
        {action ? <div className="mb-5 flex justify-end">{action}</div> : null}
        {empty}
      </div>
    );

  return (
    <div className={cn("min-w-0 overflow-hidden rounded-[24px] border border-line bg-surface shadow-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-gold-500/8 to-transparent px-5 py-5 sm:px-6">
        <div className="flex items-center gap-3"><span className="h-6 w-1 rounded-full bg-gold-500" aria-hidden /><h2 className="text-base font-semibold tracking-tight text-ink">{caption}</h2><span className="rounded-full border border-gold-500/20 bg-gold-500/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-gold-800 dark:text-gold-300">{rows.length}</span></div>
      </div>
      {searchIn || filters || action ? (
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4 sm:px-6">
          {searchIn ? (
            <div className="relative min-w-0 flex-1 basis-56">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
                aria-hidden
              />
              <input
                type="search"
                value={term}
                onChange={(event) => {
                  setTerm(event.target.value);
                  setPage(1);
                }}
                aria-label={searchPlaceholder}
                placeholder={searchPlaceholder}
                className="h-11 w-full rounded-[var(--kx-radius-md)] border border-line bg-surface pl-9 pr-9 text-sm text-ink placeholder:text-ink-muted focus:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/40"
              />
              {term ? (
                <button
                  type="button"
                  onClick={() => {
                    setTerm("");
                    setPage(1);
                  }}
                  aria-label="Clear search"
                  className="kx-tap absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:text-ink"
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
          ) : null}
          {filters}
          {action ? (
            <div className="flex w-full min-w-0 flex-wrap gap-2 sm:ml-auto sm:w-auto sm:justify-end">
              {action}
            </div>
          ) : null}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <Card radius="xl">
          <EmptyState
            icon={Search}
            size="sm"
            title="Nothing matches that search"
            description="Try a shorter term, or clear the search to see every record."
          />
        </Card>
      ) : (
        <DataTable
          className="px-3 py-3 lg:p-0"
          rows={visible}
          columns={columns}
          rowKey={rowKey}
          caption={caption}
          rowTone={rowTone}
          rowHref={rowHref}
          onRowClick={onRowClick}
          sort={sort}
          onSortChange={changeSort}
          stickyHeader
          maxHeight={680}
        />
      )}

      {paginate || showCount ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-nested/40 px-5 py-4">
          <p className="type-meta text-ink-muted" role="status">
            {ordered.length === 0
              ? "No records"
              : `${start + 1}–${paginate ? Math.min(start + pageSize, ordered.length) : ordered.length} of ${ordered.length}`}
            {query.trim() && ordered.length !== rows.length ? ` matching · ${rows.length} total` : ""}
          </p>

          {paginate && ordered.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="type-meta flex items-center gap-2 text-ink-muted">
                <span className="sr-only sm:not-sr-only">Rows</span>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                  aria-label="Rows per page"
                  className="h-9 rounded-[var(--kx-radius-sm)] border border-line bg-surface px-2 text-sm text-ink"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                size="sm"
                variant="secondary"
                icon={ChevronLeft}
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
              >
                Previous
              </Button>
              <span className="type-meta text-ink-secondary">
                Page {current} of {pageCount}
              </span>
              <Button
                size="sm"
                variant="secondary"
                iconRight={ChevronRight}
                disabled={current === pageCount}
                onClick={() => setPage(current + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
