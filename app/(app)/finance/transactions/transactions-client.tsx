"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Paperclip, Plus, Receipt, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type ServerColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ClearFilters, DateRangeFilter, FilterBar, SearchFilter, SelectFilter } from "@/components/shared/list-filters";
import { StatusBadge } from "@/components/shared/status-badge";
import { StudentPicker } from "@/components/shared/student-picker";
import { useUrlState } from "@/components/shared/use-url-state";
import { openTransactionSheet } from "@/components/finance/transaction-events";
import { downloadMoneyReceipt } from "@/components/finance/money-receipt";
import { PAYMENT_METHODS } from "@/lib/constants";
import { fmtDate, fmtMoney } from "@/lib/format";
import { deleteTransaction, updateTransactionField } from "@/server/actions/finance";
import { getSignedUrls } from "@/server/actions/files";

export type TxnRow = {
  id: string; type: "income" | "expense"; txn_date: string; amount: number; currency: string; exchange_rate: number; amount_bdt: number;
  payment_method: string; reference_no: string | null; vendor: string | null; note: string | null; receipt_path: string | null; receipt_no: string | null;
  category_id: string; category: { name: string } | null; student: { id: string; full_name: string } | null;
};

/** Click-to-edit cell; commits on blur/Enter, Escape cancels. */
function InlineCell({ value, display, type = "text", options, onSave, disabled, label }: {
  value: string; display: React.ReactNode; type?: "text" | "number" | "date" | "select"; options?: { value: string; label: string }[];
  onSave: (v: string) => Promise<void>; disabled?: boolean; label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  if (disabled) return <>{display}</>;
  if (!editing)
    return (
      <button type="button" className="rounded px-1 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { setV(value); setEditing(true); }} aria-label={`Edit ${label}`}>
        {display}
      </button>
    );
  const commit = async () => {
    setEditing(false);
    if (v !== value) await onSave(v);
  };
  if (type === "select")
    return (
      <select autoFocus aria-label={label} className="h-8 rounded border bg-background px-1 text-sm" value={v} onChange={(e) => setV(e.target.value)} onBlur={commit}>
        {options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  return (
    <Input
      autoFocus
      aria-label={label}
      type={type}
      className="h-8 w-32"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
    />
  );
}

export function TransactionsClient(props: {
  rows: TxnRow[]; total: number; page: number; size: number; sort: string; dir: "asc" | "desc";
  categories: { id: string; type: string; name: string }[]; studentFilter: string;
  perms: { edit: boolean; delete: boolean; export: boolean };
}) {
  const router = useRouter();
  const qs = useSearchParams().toString();
  const { set } = useUrlState();
  const save = (id: string, field: "txn_date" | "amount" | "payment_method" | "reference_no" | "note" | "category_id") => async (value: string) => {
    const r = await updateTransactionField({ id, field, value });
    r.ok ? toast.success(r.message) : toast.error(r.error);
    router.refresh();
  };
  const canEdit = props.perms.edit;
  const columns: ServerColumn<TxnRow>[] = [
    { id: "date", header: "Date", meta: { sortKey: "date" }, cell: ({ row: { original: t } }) => <InlineCell label="date" disabled={!canEdit} type="date" value={t.txn_date} display={<span className="whitespace-nowrap">{fmtDate(t.txn_date)}</span>} onSave={save(t.id, "txn_date")} /> },
    { id: "type", header: "Type", cell: ({ row: { original: t } }) => <StatusBadge tone={t.type === "income" ? "green" : "red"}>{t.type === "income" ? "Income" : "Expense"}</StatusBadge> },
    {
      id: "category", header: "Category",
      cell: ({ row: { original: t } }) => (
        <InlineCell label="category" disabled={!canEdit} type="select" value={t.category_id} display={t.category?.name ?? "—"} onSave={save(t.id, "category_id")}
          options={props.categories.filter((c) => c.type === t.type).map((c) => ({ value: c.id, label: c.name }))} />
      ),
    },
    {
      id: "party", header: "Student / vendor",
      cell: ({ row: { original: t } }) => t.student ? <Link href={`/students/${t.student.id}?tab=payments`} className="text-primary hover:underline">{t.student.full_name}</Link> : t.vendor ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "amount", header: "Amount", meta: { sortKey: "amount", className: "text-right" },
      cell: ({ row: { original: t } }) => (
        <div className="text-right">
          <InlineCell label="amount" disabled={!canEdit} type="number" value={String(t.amount)} onSave={save(t.id, "amount")}
            display={<span className={`whitespace-nowrap font-medium ${t.type === "income" ? "text-success" : "text-destructive"}`}>{t.type === "expense" ? "−" : ""}{fmtMoney(t.amount, t.currency)}</span>} />
          {t.currency !== "BDT" && <p className="text-xs text-muted-foreground">{fmtMoney(t.amount_bdt, "BDT")} @ {Number(t.exchange_rate)}</p>}
        </div>
      ),
    },
    { id: "method", header: "Method", cell: ({ row: { original: t } }) => <InlineCell label="payment method" disabled={!canEdit} type="select" value={t.payment_method} display={t.payment_method} onSave={save(t.id, "payment_method")} options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} /> },
    { id: "ref", header: "Reference", cell: ({ row: { original: t } }) => <InlineCell label="reference" disabled={!canEdit} value={t.reference_no ?? ""} display={t.reference_no ?? <span className="text-muted-foreground">—</span>} onSave={save(t.id, "reference_no")} /> },
    { id: "note", header: "Note", cell: ({ row: { original: t } }) => <InlineCell label="note" disabled={!canEdit} value={t.note ?? ""} display={<span className="line-clamp-1 max-w-48">{t.note ?? <span className="text-muted-foreground">—</span>}</span>} onSave={save(t.id, "note")} /> },
    {
      id: "actions", header: () => <span className="sr-only">Actions</span>,
      cell: ({ row: { original: t } }) => (
        <div className="flex justify-end gap-1">
          {t.receipt_path && (
            <Button size="icon" variant="ghost" aria-label="Open attached receipt" onClick={async () => { const u = (await getSignedUrls("receipts", [t.receipt_path!]))[t.receipt_path!]; if (u) window.open(u, "_blank"); }}><Paperclip /></Button>
          )}
          {t.receipt_no && <Button size="icon" variant="ghost" aria-label={`Money receipt ${t.receipt_no}`} title={`Money receipt ${t.receipt_no}`} onClick={() => downloadMoneyReceipt(t.id)}><Receipt /></Button>}
          {props.perms.delete && (
            <ConfirmDialog trigger={<Button size="icon" variant="ghost" aria-label="Delete transaction"><Trash2 className="text-destructive" /></Button>} title="Delete this transaction?" description="It moves to Deleted items and is excluded from reports."
              onConfirm={async () => { const r = await deleteTransaction(t.id); r.ok ? toast.success(r.message) : toast.error(r.error); router.refresh(); }} />
          )}
        </div>
      ),
    },
  ];
  return (
    <>
      <FilterBar>
        <SearchFilter placeholder="Reference, vendor, note, receipt no…" />
        <SelectFilter param="type" label="Types" options={[{ value: "income", label: "Income" }, { value: "expense", label: "Expense" }]} width="w-full sm:w-32" />
        <SelectFilter param="category" label="Categories" options={props.categories.map((c) => ({ value: c.id, label: `${c.name} (${c.type})` }))} />
        <SelectFilter param="method" label="Methods" options={PAYMENT_METHODS} width="w-full sm:w-36" />
        <div className="w-full sm:w-56"><StudentPicker value={props.studentFilter} placeholder="Student…" onChange={(id) => set({ student: id || null })} /></div>
        <DateRangeFilter />
        <ClearFilters />
        <div className="flex gap-2 sm:ml-auto">
          {props.perms.export && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline"><Download /> Export</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild><a href={`/api/export/transactions?format=xlsx&${qs}`}>Excel (.xlsx)</a></DropdownMenuItem>
                <DropdownMenuItem asChild><a href={`/api/export/transactions?format=csv&${qs}`}>CSV</a></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button onClick={() => openTransactionSheet("income")}><Plus /> Add</Button>
        </div>
      </FilterBar>
      {canEdit && <p className="mb-2 text-xs text-muted-foreground">Tip: click a date, amount, category, method, reference or note to edit it in place.</p>}
      <DataTable columns={columns} data={props.rows} total={props.total} page={props.page} size={props.size} sort={props.sort} dir={props.dir} getRowId={(r) => r.id}
        empty={<EmptyState icon={Wallet} title="No transactions" action={<Button onClick={() => openTransactionSheet("income")}><Plus /> Add transaction</Button>} />} />
    </>
  );
}
