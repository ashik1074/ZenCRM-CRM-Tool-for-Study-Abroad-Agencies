"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type ServerColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { restoreItem } from "@/server/actions/trash";

type Row = { id: string; label: string; deleted_at: string };

export function TrashList({ table, rows, total, page, size, canRestore }: { table: "students" | "offers" | "tasks" | "transactions"; rows: Row[]; total: number; page: number; size: number; canRestore: boolean }) {
  const router = useRouter();
  const columns: ServerColumn<Row>[] = [
    { id: "label", header: "Record", cell: ({ row }) => <span className="font-medium">{row.original.label}</span> },
    { id: "deleted", header: "Deleted", cell: ({ row }) => row.original.deleted_at },
    {
      id: "actions", header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => canRestore && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={async () => {
            const r = await restoreItem(table, row.original.id);
            r.ok ? toast.success(r.message) : toast.error(r.error);
            router.refresh();
          }}><ArchiveRestore /> Restore</Button>
        </div>
      ),
    },
  ];
  return <DataTable columns={columns} data={rows} total={total} page={page} size={size} getRowId={(r) => r.id} empty={<EmptyState icon={Trash2} title="Nothing deleted here" />} />;
}
