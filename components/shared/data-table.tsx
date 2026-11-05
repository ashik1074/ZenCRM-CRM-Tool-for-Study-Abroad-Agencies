"use client";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useUrlState } from "./use-url-state";

export type ServerColumn<T> = ColumnDef<T, unknown> & { meta?: { sortKey?: string; className?: string } };

/**
 * Server-driven table: rows, total and page come from the server component;
 * sorting/paging update the URL which triggers a server re-render.
 */
export function DataTable<T>({
  columns,
  data,
  total,
  page,
  size,
  sort,
  dir,
  empty,
  rowClassName,
  getRowId,
}: {
  columns: ServerColumn<T>[];
  data: T[];
  total: number;
  page: number;
  size: number;
  sort?: string;
  dir?: "asc" | "desc";
  empty?: React.ReactNode;
  rowClassName?: (row: T) => string | undefined;
  getRowId?: (row: T) => string;
}) {
  const { set, pending } = useUrlState();
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: Math.ceil(total / size),
    getRowId: getRowId as never,
  });
  const pages = Math.max(1, Math.ceil(total / size));

  return (
    <div className={cn("rounded-lg border bg-card transition-opacity", pending && "opacity-60")} aria-busy={pending}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const meta = (h.column.columnDef as ServerColumn<T>).meta;
                  const sortKey = meta?.sortKey;
                  const active = sortKey && sort === sortKey;
                  const label = h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext());
                  return (
                    <TableHead
                      key={h.id}
                      className={cn("whitespace-nowrap", meta?.className)}
                      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
                    >
                      {sortKey ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => set({ sort: sortKey, dir: active && dir === "asc" ? "desc" : "asc" })}
                        >
                          {label}
                          {active ? (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                        </button>
                      ) : (
                        label
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  <div className="p-4">{empty ?? <p className="py-8 text-center text-sm text-muted-foreground">No records found.</p>}</div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className={rowClassName?.(row.original)}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={(cell.column.columnDef as ServerColumn<T>).meta?.className}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-sm text-muted-foreground">
        <span>
          {total === 0 ? "0 records" : `${(page - 1) * size + 1}–${Math.min(page * size, total)} of ${total}`}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) }, { resetPage: false })} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <span className="px-2">
            Page {page} of {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => set({ page: String(page + 1) }, { resetPage: false })} aria-label="Next page">
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
