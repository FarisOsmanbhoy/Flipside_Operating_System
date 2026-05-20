"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode, type CSSProperties } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/format";

export type Column<T> = {
  key: string;
  header: ReactNode;
  accessor: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | Date | null | undefined;
  width?: string;
  align?: "left" | "right" | "center";
  className?: string;
};

type Props<T> = {
  rows: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  getRowHref?: (row: T) => string;
  onRowSelect?: (row: T) => void;
  selectedId?: string | null;
  getStatusColor?: (row: T) => string | undefined;
  initialSort?: { key: string; dir: "asc" | "desc" };
  emptyState?: ReactNode;
  dense?: boolean;
  className?: string;
};

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  getRowHref,
  onRowSelect,
  selectedId,
  getStatusColor,
  initialSort,
  emptyState,
  dense,
  className,
}: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(
    initialSort ?? null,
  );

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort(
      (a, b) => compare(col.sortValue!(a), col.sortValue!(b)) * dir,
    );
  }, [rows, sort, columns]);

  const toggleSort = (key: string) => {
    setSort((cur) => {
      if (cur?.key !== key) return { key, dir: "asc" };
      if (cur.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const isSelectable = !!(onRowSelect || getRowHref);
  const alignClass = (a?: Column<T>["align"]) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  return (
    <Card className={cn("overflow-hidden p-0", className)}>
      <div className="overflow-x-auto">
        <table className={cn("fs-data-table", dense && "is-dense")}>
          <thead>
            <tr>
              {columns.map((col) => {
                const sortable = !!col.sortValue;
                const isSorted = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    className={cn(alignClass(col.align), col.className)}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 text-inherit hover:text-ink"
                      >
                        {col.header}
                        {isSorted ? (
                          sort.dir === "asc" ? (
                            <ChevronUp size={12} />
                          ) : (
                            <ChevronDown size={12} />
                          )
                        ) : (
                          <ChevronsUpDown size={12} className="opacity-40" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12">
                  {emptyState ?? (
                    <span className="text-sm text-muted">No results</span>
                  )}
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => {
                const id = getRowId(row);
                const stripe = getStatusColor?.(row);
                const isSelected = selectedId === id;
                const style: CSSProperties | undefined = stripe
                  ? ({ ["--stripe" as string]: stripe } as CSSProperties)
                  : undefined;

                const onClick = () => onRowSelect?.(row);

                return (
                  <tr
                    key={id}
                    style={style}
                    className={cn(
                      stripe && "fs-status-stripe",
                      isSelectable && "is-selectable",
                      isSelected && "is-selected",
                    )}
                    aria-selected={isSelectable ? isSelected : undefined}
                    onClick={onRowSelect ? onClick : undefined}
                  >
                    {columns.map((col, idx) => {
                      const cell = col.accessor(row);
                      const wrapInLink = idx === 0 && getRowHref;
                      return (
                        <td
                          key={col.key}
                          className={cn(alignClass(col.align), col.className)}
                        >
                          {wrapInLink ? (
                            <Link
                              href={getRowHref(row)}
                              onClick={(e) => e.stopPropagation()}
                              className="text-brand-700 hover:underline font-medium"
                            >
                              {cell}
                            </Link>
                          ) : (
                            cell
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
