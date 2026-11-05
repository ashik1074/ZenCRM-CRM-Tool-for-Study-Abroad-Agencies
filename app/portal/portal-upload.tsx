"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Field, nativeSelectClass } from "@/components/shared/field";
import { FileUploader } from "@/components/shared/file-uploader";
import { registerStudentDocument } from "@/server/actions/students";

export function PortalUpload({ studentId, categories }: { studentId: string; categories: string[] }) {
  const router = useRouter();
  const [category, setCategory] = useState(categories[0] ?? "Other");
  return (
    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-end">
      <Field label="Document type">
        {(p) => <select className={nativeSelectClass} {...p} value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c}>{c}</option>)}</select>}
      </Field>
      <FileUploader
        bucket="student-files"
        folder={studentId}
        compact
        onUploaded={async (f) => {
          const r = await registerStudentDocument({ ...f, student_id: studentId, category, expiry_date: "" });
          if (!r.ok) { toast.error(r.error); return false; }
          toast.success(`${f.file_name} uploaded`);
          router.refresh();
        }}
      />
    </div>
  );
}
