"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { softDeleteStudent } from "@/server/actions/students";

export function DeleteStudentButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={<Button variant="outline" className="text-destructive"><Trash2 /> Delete</Button>}
      title={`Delete ${name}?`}
      description="The student moves to Deleted items. An Admin can restore it."
      onConfirm={async () => {
        const r = await softDeleteStudent(id);
        if (r.ok) {
          toast.success(r.message);
          router.push("/students");
        } else toast.error(r.error);
      }}
    />
  );
}
