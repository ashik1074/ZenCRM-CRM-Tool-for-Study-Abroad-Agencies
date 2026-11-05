"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskFormDialog, type TaskFormOptions } from "@/components/tasks/task-form-dialog";

export function StudentTaskButton({ options, studentId, studentName }: { options: TaskFormOptions; studentId: string; studentName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex justify-end">
      <Button onClick={() => setOpen(true)}><Plus /> Add task for this student</Button>
      {open && <TaskFormDialog options={options} initial={{ student_id: studentId }} studentLabel={studentName} onClose={() => setOpen(false)} />}
    </div>
  );
}
