"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DataTable, type ServerColumn } from "@/components/shared/data-table";
import { ClearFilters, DateRangeFilter, FilterBar, SelectFilter } from "@/components/shared/list-filters";
import { StatusBadge } from "@/components/shared/status-badge";
import { fmtDateTime, humanize } from "@/lib/format";

export type AuditRow = {
  id: string; table_name: string; record_id: string | null; action: string; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null;
  changed_fields: string[] | null; created_at: string; actor: { full_name: string } | null;
};

const TONE: Record<string, "green" | "blue" | "red" | "amber" | "teal"> = { insert: "green", update: "blue", delete: "red", soft_delete: "amber", restore: "teal" };
const LINK: Record<string, (id: string) => string> = {
  students: (id) => `/students/${id}`, tasks: (id) => `/tasks?task=${id}`, offers: (id) => `/offers?offer=${id}&status=all`, kb_entries: (id) => `/kb?entry=${id}`,
};
const show = (v: unknown) => (v === null || v === undefined ? "∅" : typeof v === "object" ? JSON.stringify(v) : String(v));

function Diff({ row }: { row: AuditRow }) {
  const keys = row.action === "update" || row.action === "soft_delete" || row.action === "restore"
    ? (row.changed_fields ?? Object.keys(row.new_data ?? {}))
    : Object.keys(row.new_data ?? row.old_data ?? {});
  return (
    <table className="mt-2 w-full text-xs">
      <thead className="text-left text-muted-foreground"><tr><th className="py-1 pr-2 font-medium">Field</th><th className="pr-2 font-medium">Old</th><th className="font-medium">New</th></tr></thead>
      <tbody>
        {keys.filter((k) => !["updated_at", "search"].includes(k)).map((k) => (
          <tr key={k} className="border-t align-top">
            <td className="py-1 pr-2 font-medium">{humanize(k)}</td>
            <td className="max-w-xs break-all pr-2 text-destructive">{show(row.old_data?.[k])}</td>
            <td className="max-w-xs break-all text-success">{show(row.new_data?.[k])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AuditClient({ rows, total, page, size, users, tables }: { rows: AuditRow[]; total: number; page: number; size: number; users: { id: string; full_name: string }[]; tables: string[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const columns: ServerColumn<AuditRow>[] = [
    { id: "when", header: "When", cell: ({ row }) => <span className="whitespace-nowrap">{fmtDateTime(row.original.created_at)}</span> },
    { id: "who", header: "Who", cell: ({ row }) => row.original.actor?.full_name ?? <span className="text-muted-foreground">System</span> },
    { id: "action", header: "Action", cell: ({ row }) => <StatusBadge tone={TONE[row.original.action] ?? "gray"}>{humanize(row.original.action)}</StatusBadge> },
    {
      id: "what", header: "Record",
      cell: ({ row: { original: r } }) => {
        const label = (r.new_data?.full_name ?? r.new_data?.title ?? r.new_data?.name ?? r.old_data?.full_name ?? r.old_data?.title ?? r.old_data?.name) as string | undefined;
        const href = r.record_id && LINK[r.table_name]?.(r.record_id);
        return <div><p>{humanize(r.table_name)}</p>{label && (href ? <Link href={href} className="text-xs text-primary hover:underline">{label}</Link> : <p className="text-xs text-muted-foreground">{label}</p>)}</div>;
      },
    },
    {
      id: "changes", header: "Changes",
      cell: ({ row: { original: r } }) => {
        const isOpen = open.has(r.id);
        return (
          <div className="min-w-64">
            <button type="button" className="inline-flex items-center gap-1 text-left text-xs hover:underline" aria-expanded={isOpen}
              onClick={() => setOpen((s) => { const n = new Set(s); isOpen ? n.delete(r.id) : n.add(r.id); return n; })}>
              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {r.changed_fields?.length ? r.changed_fields.filter((f) => f !== "updated_at").map(humanize).join(", ") : r.action === "insert" ? "Created" : "Deleted"}
            </button>
            {isOpen && <Diff row={r} />}
          </div>
        );
      },
    },
  ];
  return (
    <>
      <FilterBar>
        <SelectFilter param="table" label="Record types" options={tables.map((t) => ({ value: t, label: humanize(t) }))} />
        <SelectFilter param="actor" label="Users" options={users.map((u) => ({ value: u.id, label: u.full_name }))} />
        <SelectFilter param="action" label="Actions" options={Object.keys(TONE).map((a) => ({ value: a, label: humanize(a) }))} width="w-full sm:w-36" />
        <DateRangeFilter />
        <ClearFilters />
      </FilterBar>
      <DataTable columns={columns} data={rows} total={total} page={page} size={size} getRowId={(r) => r.id} />
    </>
  );
}
