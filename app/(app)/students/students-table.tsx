"use client";
import Link from "next/link";
import { GraduationCap, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DataTable, type ServerColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { OptionBadge, StatusBadge } from "@/components/shared/status-badge";
import { STUDENT_STATUSES } from "@/lib/constants";
import { fmtDate, initials } from "@/lib/format";

export type StudentListRow = {
  id: string;
  student_code: string;
  full_name: string;
  phone: string | null;
  photo_path: string | null;
  photo_url?: string | null;
  status: string;
  is_draft: boolean;
  intake: string | null;
  created_at: string;
  counselor: { full_name: string } | null;
  apps: { count: number }[];
};

const columns: ServerColumn<StudentListRow>[] = [
  {
    id: "photo",
    header: () => <span className="sr-only">Photo</span>,
    cell: ({ row }) => (
      <Avatar className="h-9 w-9">
        {row.original.photo_url && <AvatarImage src={row.original.photo_url} alt="" className="object-cover" />}
        <AvatarFallback className="text-xs">{initials(row.original.full_name)}</AvatarFallback>
      </Avatar>
    ),
    meta: { className: "w-12" },
  },
  {
    id: "name",
    header: "Name",
    meta: { sortKey: "name" },
    cell: ({ row }) => (
      <div>
        <Link href={`/students/${row.original.id}`} className="font-medium text-primary hover:underline">
          {row.original.full_name}
        </Link>
        <p className="text-xs text-muted-foreground">{row.original.student_code}</p>
      </div>
    ),
  },
  { id: "phone", header: "Phone", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.phone ?? "—"}</span> },
  { id: "counselor", header: "Counselor", cell: ({ row }) => row.original.counselor?.full_name ?? <span className="text-muted-foreground">Unassigned</span> },
  {
    id: "status",
    header: "Status",
    meta: { sortKey: "status" },
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        <OptionBadge list={STUDENT_STATUSES} value={row.original.status} />
        {row.original.is_draft && <StatusBadge tone="amber">Draft</StatusBadge>}
      </div>
    ),
  },
  { id: "intake", header: "Intake", meta: { sortKey: "intake" }, cell: ({ row }) => row.original.intake ?? "—" },
  { id: "apps", header: "Applied", cell: ({ row }) => row.original.apps?.[0]?.count ?? 0, meta: { className: "text-center" } },
  { id: "created", header: "Created", meta: { sortKey: "created" }, cell: ({ row }) => <span className="whitespace-nowrap">{fmtDate(row.original.created_at)}</span> },
];

export function StudentsTable(props: { rows: StudentListRow[]; total: number; page: number; size: number; sort: string; dir: "asc" | "desc"; canCreate: boolean }) {
  return (
    <DataTable
      columns={columns}
      data={props.rows}
      total={props.total}
      page={props.page}
      size={props.size}
      sort={props.sort}
      dir={props.dir}
      getRowId={(r) => r.id}
      empty={
        <EmptyState
          icon={GraduationCap}
          title="No students found"
          description="Try different filters, or enroll your first student."
          action={props.canCreate && <Button asChild><Link href="/students/new"><Plus /> Enroll student</Link></Button>}
        />
      }
    />
  );
}
