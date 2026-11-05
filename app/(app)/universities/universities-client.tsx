"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ExternalLink, Landmark, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable, type ServerColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field } from "@/components/shared/field";
import { ClearFilters, FilterBar, SearchFilter, SelectFilter } from "@/components/shared/list-filters";
import { StatusBadge } from "@/components/shared/status-badge";
import { universitySchema, type UniversityInput } from "@/lib/validation/offers";
import { deleteUniversity, saveUniversity } from "@/server/actions/offers";

export type UniversityRow = {
  id: string; name: string; city: string | null; province: string | null; ranking: number | null; website: string | null;
  contact_person: string | null; email: string | null; phone: string | null; notes: string | null; is_active: boolean;
  offers: { count: number }[]; applications: { count: number }[];
};
type Perms = { create: boolean; edit: boolean; delete: boolean };

export function UniversitiesClient(props: {
  rows: UniversityRow[]; total: number; page: number; size: number; sort: string; dir: "asc" | "desc"; cities: string[]; perms: Perms; openId?: string;
}) {
  const [editing, setEditing] = useState<UniversityRow | "new" | null>(() => (props.openId ? props.rows.find((r) => r.id === props.openId) ?? null : null));
  const router = useRouter();
  const columns: ServerColumn<UniversityRow>[] = [
    {
      id: "name", header: "University", meta: { sortKey: "name" },
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          {row.original.website && <a href={row.original.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Website <ExternalLink className="h-3 w-3" /></a>}
        </div>
      ),
    },
    { id: "city", header: "City", meta: { sortKey: "city" }, cell: ({ row }) => [row.original.city, row.original.province].filter(Boolean).join(", ") || "—" },
    { id: "ranking", header: "Ranking", meta: { sortKey: "ranking" }, cell: ({ row }) => row.original.ranking ?? "—" },
    { id: "contact", header: "Contact", cell: ({ row }) => <div className="text-sm">{row.original.contact_person ?? "—"}<p className="text-xs text-muted-foreground">{row.original.email}</p></div> },
    { id: "offers", header: "Offers", cell: ({ row }) => <Link className="text-primary hover:underline" href={`/offers?university=${row.original.id}&status=all`}>{row.original.offers?.[0]?.count ?? 0}</Link> },
    { id: "apps", header: "Applications", cell: ({ row }) => row.original.applications?.[0]?.count ?? 0 },
    { id: "active", header: "Status", cell: ({ row }) => (row.original.is_active ? <StatusBadge tone="green">Active</StatusBadge> : <StatusBadge tone="gray">Inactive</StatusBadge>) },
    {
      id: "actions", header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {props.perms.edit && <Button size="icon" variant="ghost" aria-label={`Edit ${row.original.name}`} onClick={() => setEditing(row.original)}><Pencil /></Button>}
          {props.perms.delete && (
            <ConfirmDialog
              trigger={<Button size="icon" variant="ghost" aria-label={`Delete ${row.original.name}`}><Trash2 className="text-destructive" /></Button>}
              title={`Delete ${row.original.name}?`}
              onConfirm={async () => {
                const r = await deleteUniversity(row.original.id);
                r.ok ? toast.success(r.message) : toast.error(r.error);
                router.refresh();
              }}
            />
          )}
        </div>
      ),
    },
  ];
  return (
    <>
      <FilterBar>
        <SearchFilter placeholder="Name, city, contact…" />
        <SelectFilter param="city" label="Cities" options={props.cities} />
        <SelectFilter param="active" label="Status" options={[{ value: "yes", label: "Active" }, { value: "no", label: "Inactive" }]} width="w-full sm:w-36" />
        <ClearFilters />
        {props.perms.create && <Button className="sm:ml-auto" onClick={() => setEditing("new")}><Plus /> Add university</Button>}
      </FilterBar>
      <DataTable
        columns={columns} data={props.rows} total={props.total} page={props.page} size={props.size} sort={props.sort} dir={props.dir}
        getRowId={(r) => r.id}
        empty={<EmptyState icon={Landmark} title="No universities" action={props.perms.create && <Button onClick={() => setEditing("new")}><Plus /> Add university</Button>} />}
      />
      {editing && <UniversityDialog row={editing === "new" ? null : editing} readOnly={!props.perms.edit && editing !== "new"} onClose={() => setEditing(null)} />}
    </>
  );
}

function UniversityDialog({ row, onClose, readOnly }: { row: UniversityRow | null; onClose: () => void; readOnly: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const form = useForm<UniversityInput, unknown, z.output<typeof universitySchema>>({
    resolver: zodResolver(universitySchema),
    defaultValues: row
      ? { id: row.id, name: row.name, city: s(row.city), province: s(row.province), ranking: s(row.ranking), website: s(row.website), contact_person: s(row.contact_person), email: s(row.email), phone: s(row.phone), notes: s(row.notes), is_active: row.is_active }
      : { is_active: true },
  });
  const e = form.formState.errors;
  const r = form.register;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{row ? row.name : "Add university"}</DialogTitle></DialogHeader>
        <form
          noValidate
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={form.handleSubmit(() => start(async () => {
            const res = await saveUniversity(form.getValues());
            if (res.ok) { toast.success(res.message); onClose(); router.refresh(); } else toast.error(res.error);
          }))}
        >
          <fieldset disabled={readOnly} className="contents">
            <Field label="Name" required error={e.name?.message} className="sm:col-span-2">{(p) => <Input {...p} {...r("name")} />}</Field>
            <Field label="City">{(p) => <Input {...p} {...r("city")} />}</Field>
            <Field label="Province">{(p) => <Input {...p} {...r("province")} />}</Field>
            <Field label="Ranking (optional)" error={e.ranking?.message}>{(p) => <Input type="number" {...p} {...r("ranking")} />}</Field>
            <Field label="Website" error={e.website?.message}>{(p) => <Input {...p} {...r("website")} placeholder="https://" />}</Field>
            <Field label="Contact person">{(p) => <Input {...p} {...r("contact_person")} />}</Field>
            <Field label="Email" error={e.email?.message}>{(p) => <Input type="email" {...p} {...r("email")} />}</Field>
            <Field label="Phone">{(p) => <Input {...p} {...r("phone")} />}</Field>
            <div className="flex items-center gap-2 self-end pb-2">
              <Checkbox id="uni-active" checked={form.watch("is_active")} onCheckedChange={(v) => form.setValue("is_active", v === true)} />
              <Label htmlFor="uni-active">Active partner</Label>
            </div>
            <Field label="Notes" className="sm:col-span-2">{(p) => <Textarea {...p} {...r("notes")} />}</Field>
          </fieldset>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>{readOnly ? "Close" : "Cancel"}</Button>
            {!readOnly && <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Save</Button>}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
