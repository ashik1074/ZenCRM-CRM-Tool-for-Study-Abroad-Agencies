"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, CircleX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Field, nativeSelectClass } from "@/components/shared/field";
import { FileUploader } from "@/components/shared/file-uploader";
import { FileGallery, type GalleryFile } from "@/components/shared/file-gallery";
import { fmtDate } from "@/lib/format";
import { deleteStudentDocument, registerStudentDocument } from "@/server/actions/students";

export type ChecklistItem = { category: string; status: "received" | "missing" | "expired"; document_count: number; expiry_date: string | null };

export function ChecklistTracker({ items }: { items: ChecklistItem[] }) {
  const received = items.filter((i) => i.status === "received").length;
  const pct = items.length ? Math.round((received / items.length) * 100) : 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          Visa document checklist <span className="text-sm font-normal text-muted-foreground">{received}/{items.length} received</span>
        </CardTitle>
        <Progress value={pct} aria-label={`${pct}% of required documents received`} />
      </CardHeader>
      <CardContent>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {items.map((i) => (
            <li key={i.category} className="flex items-center gap-2 text-sm">
              {i.status === "received" ? (
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
              ) : i.status === "expired" ? (
                <CircleAlert className="h-4 w-4 text-warning" aria-hidden />
              ) : (
                <CircleX className="h-4 w-4 text-destructive" aria-hidden />
              )}
              <span className="font-medium">{i.category}</span>
              <span className="text-muted-foreground">
                {i.status === "received" ? `received${i.document_count > 1 ? ` (${i.document_count})` : ""}` : i.status === "expired" ? `expired ${fmtDate(i.expiry_date)}` : "missing"}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function DocumentsPanel({
  studentId,
  files,
  categories,
  canUpload,
  canDelete,
}: {
  studentId: string;
  files: GalleryFile[];
  categories: string[];
  canUpload: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [category, setCategory] = useState(categories[0] ?? "Other");
  const [expiry, setExpiry] = useState("");
  const [filter, setFilter] = useState("");
  const shown = filter ? files.filter((f) => f.category === filter) : files;
  return (
    <div className="space-y-4">
      {canUpload && (
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-[200px_180px_1fr] sm:items-end">
            <Field label="Category">
              {(p) => (
                <select className={nativeSelectClass} {...p} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </select>
              )}
            </Field>
            <Field label="Expiry date (optional)">{(p) => <Input type="date" {...p} value={expiry} onChange={(e) => setExpiry(e.target.value)} />}</Field>
            <FileUploader
              bucket="student-files"
              folder={studentId}
              compact
              onUploaded={async (f) => {
                const r = await registerStudentDocument({ ...f, student_id: studentId, category, expiry_date: expiry });
                if (!r.ok) {
                  toast.error(r.error);
                  return false;
                }
                toast.success(`${f.file_name} uploaded`);
                router.refresh();
              }}
            />
          </CardContent>
        </Card>
      )}
      <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by category">
        {["", ...categories].map((c) => {
          const n = c ? files.filter((f) => f.category === c).length : files.length;
          if (c && !n) return null;
          return (
            <button
              key={c || "all"}
              type="button"
              aria-pressed={filter === c}
              onClick={() => setFilter(c)}
              className={`rounded-full border px-3 py-1 text-xs ${filter === c ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {c || "All"} ({n})
            </button>
          );
        })}
      </div>
      <FileGallery
        bucket="student-files"
        files={shown}
        canDelete={canDelete}
        emptyText="No documents uploaded yet."
        onDelete={async (f) => {
          const r = await deleteStudentDocument(f.id);
          r.ok ? toast.success(r.message) : toast.error(r.error);
          router.refresh();
        }}
      />
    </div>
  );
}
