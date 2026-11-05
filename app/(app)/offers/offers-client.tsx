"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Download, FileBadge, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTable, type ServerColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ClearFilters, DateRangeFilter, FilterBar, SearchFilter, SelectFilter } from "@/components/shared/list-filters";
import { OptionBadge, StatusBadge } from "@/components/shared/status-badge";
import { OfferModal } from "@/components/offers/offer-modal";
import { OfferFormSheet } from "@/components/offers/offer-form";
import { DEGREE_LEVELS, OFFER_STATUSES, SCHOLARSHIP_TYPES } from "@/lib/constants";
import { daysUntil, fmtDate, fmtMoney } from "@/lib/format";

export type OfferRow = {
  id: string;
  title: string;
  program: string;
  degree_level: string;
  intake: string | null;
  scholarship_type: string | null;
  application_deadline: string | null;
  status: string;
  tuition_fee: number | null;
  fee_currency: string;
  university: { id: string; name: string; city: string | null };
  leaflets: { count: number }[];
};

type Perms = { create: boolean; edit: boolean; delete: boolean; export: boolean };

export function OffersClient(props: {
  rows: OfferRow[];
  total: number;
  page: number;
  size: number;
  sort: string;
  dir: "asc" | "desc";
  universities: { id: string; name: string; city: string | null }[];
  cities: string[];
  intakes: string[];
  perms: Perms;
  initialOfferId?: string;
  openNew?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(props.initialOfferId ?? null);
  const [editingId, setEditingId] = useState<string | "new" | null>(props.openNew && props.perms.create ? "new" : null);
  const qs = useSearchParams().toString();
  useEffect(() => {
    if (props.initialOfferId) setOpenId(props.initialOfferId);
  }, [props.initialOfferId]);

  const columns: ServerColumn<OfferRow>[] = [
    {
      id: "title",
      header: "Offer",
      meta: { sortKey: "title" },
      cell: ({ row }) => (
        <div className="min-w-48">
          <button type="button" onClick={() => setOpenId(row.original.id)} className="text-left font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {row.original.title}
          </button>
          <p className="text-xs text-muted-foreground">{row.original.program}</p>
        </div>
      ),
    },
    { id: "uni", header: "University", cell: ({ row }) => <div><p>{row.original.university.name}</p><p className="text-xs text-muted-foreground">{row.original.university.city}</p></div> },
    { id: "degree", header: "Degree", cell: ({ row }) => row.original.degree_level },
    { id: "intake", header: "Intake", meta: { sortKey: "intake" }, cell: ({ row }) => row.original.intake ?? "—" },
    { id: "sch", header: "Scholarship", cell: ({ row }) => (row.original.scholarship_type ? <StatusBadge tone={row.original.scholarship_type === "CSC" ? "violet" : "sky"}>{row.original.scholarship_type}</StatusBadge> : "—") },
    { id: "fee", header: "Tuition / yr", cell: ({ row }) => <span className="whitespace-nowrap">{fmtMoney(row.original.tuition_fee, row.original.fee_currency)}</span> },
    {
      id: "deadline",
      header: "Deadline",
      meta: { sortKey: "deadline" },
      cell: ({ row }) => {
        const d = daysUntil(row.original.application_deadline);
        return (
          <span className={`whitespace-nowrap ${d !== null && d >= 0 && d <= 14 && row.original.status === "open" ? "font-medium text-warning" : ""}`}>
            {fmtDate(row.original.application_deadline)}
            {d !== null && d >= 0 && d <= 14 && row.original.status === "open" && <span className="block text-xs">{d === 0 ? "today" : `in ${d} days`}</span>}
          </span>
        );
      },
    },
    { id: "status", header: "Status", cell: ({ row }) => <OptionBadge list={OFFER_STATUSES} value={row.original.status} /> },
  ];

  return (
    <>
      <FilterBar>
        <SearchFilter placeholder="Offer, university, program…" />
        <SelectFilter param="university" label="Universities" options={props.universities.map((u) => ({ value: u.id, label: u.name }))} />
        <SelectFilter param="city" label="Cities" options={props.cities} width="w-full sm:w-36" />
        <SelectFilter param="degree" label="Degrees" options={DEGREE_LEVELS} width="w-full sm:w-36" />
        <SelectFilter param="intake" label="Intakes" options={props.intakes} width="w-full sm:w-40" />
        <SelectFilter param="scholarship" label="Scholarships" options={SCHOLARSHIP_TYPES} width="w-full sm:w-40" />
        <StatusFilter />
        <DateRangeFilter label="Deadline" />
        <ClearFilters />
        <div className="flex gap-2 sm:ml-auto">
          {props.perms.export && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline"><Download /> Export</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild><a href={`/api/export/offers?format=xlsx&${qs}`}>Excel (.xlsx)</a></DropdownMenuItem>
                <DropdownMenuItem asChild><a href={`/api/export/offers?format=csv&${qs}`}>CSV</a></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {props.perms.create && <Button onClick={() => setEditingId("new")}><Plus /> Add offer</Button>}
        </div>
      </FilterBar>
      <DataTable
        columns={columns}
        data={props.rows}
        total={props.total}
        page={props.page}
        size={props.size}
        sort={props.sort}
        dir={props.dir}
        getRowId={(r) => r.id}
        empty={<EmptyState icon={FileBadge} title="No offers match" description="Change the filters or add a new offer." action={props.perms.create && <Button onClick={() => setEditingId("new")}><Plus /> Add offer</Button>} />}
      />
      {openId && (
        <OfferModal
          id={openId}
          perms={props.perms}
          onClose={() => setOpenId(null)}
          onEdit={(id) => { setOpenId(null); setEditingId(id); }}
        />
      )}
      {editingId && <OfferFormSheet id={editingId === "new" ? null : editingId} universities={props.universities} intakes={props.intakes} onClose={() => setEditingId(null)} />}
    </>
  );
}

function StatusFilter() {
  // default view shows open offers; "all" removes the filter
  return (
    <SelectFilter
      param="status"
      label="Status (default: open)"
      options={[...OFFER_STATUSES.map((s) => ({ value: s.value, label: s.label })), { value: "all", label: "Any status" }]}
      width="w-full sm:w-36"
    />
  );
}
