"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, nativeSelectClass } from "@/components/shared/field";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { StudentPicker } from "@/components/shared/student-picker";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { taskSchema, type TaskInput } from "@/lib/validation/tasks";
import { saveTask } from "@/server/actions/tasks";

export type TaskFormOptions = {
  users: { id: string; full_name: string }[];
  sprints: { id: string; name: string; status: string }[];
};

export function TaskFormDialog({
  options,
  initial,
  studentLabel,
  onClose,
  onSaved,
}: {
  options: TaskFormOptions;
  initial?: Partial<TaskInput>;
  studentLabel?: string | null;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [studentName, setStudentName] = useState(studentLabel ?? "");
  const activeSprint = options.sprints.find((s) => s.status === "active")?.id ?? "";
  const form = useForm<TaskInput, unknown, z.output<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: { priority: "medium", status: "todo", sprint_id: activeSprint, description: "", ...initial },
  });
  const e = form.formState.errors;
  const r = form.register;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{initial?.id ? "Edit task" : "Add task"}</DialogTitle></DialogHeader>
        <form
          noValidate
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={form.handleSubmit(() => start(async () => {
            const res = await saveTask(form.getValues());
            if (res.ok) {
              toast.success(res.message);
              onSaved?.(res.data.id);
              onClose();
              router.refresh();
            } else toast.error(res.error);
          }))}
        >
          <Field label="Title" required error={e.title?.message} className="sm:col-span-2">{(p) => <Input {...p} {...r("title")} autoFocus data-testid="task-title" />}</Field>
          <Field label="Description" className="sm:col-span-2">
            {(p) => <RichTextEditor id={p.id} value={form.watch("description") ?? ""} onChange={(v) => form.setValue("description", v, { shouldDirty: true })} placeholder="Description" />}
          </Field>
          <Field label="Assignee" hint={initial?.id ? undefined : "Defaults to you"}>
            {(p) => (
              <select className={nativeSelectClass} {...p} {...r("assignee_id")}>
                <option value="">{initial?.id ? "Unassigned" : "Me"}</option>
                {options.users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            )}
          </Field>
          <Field label="Due date" error={e.due_date?.message}>{(p) => <Input type="date" {...p} {...r("due_date")} />}</Field>
          <Field label="Priority">
            {(p) => <select className={nativeSelectClass} {...p} {...r("priority")}>{TASK_PRIORITIES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select>}
          </Field>
          <Field label="Status">
            {(p) => <select className={nativeSelectClass} {...p} {...r("status")}>{TASK_STATUSES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select>}
          </Field>
          <Field label="Sprint">
            {(p) => (
              <select className={nativeSelectClass} {...p} {...r("sprint_id")}>
                <option value="">No sprint (backlog)</option>
                {options.sprints.filter((s) => s.status !== "completed" || s.id === initial?.sprint_id).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.status === "active" ? " (active)" : s.status === "completed" ? " (completed)" : ""}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Linked student">
            {(p) => <StudentPicker id={p.id} value={form.watch("student_id") ?? ""} label={studentName} onChange={(id, s) => { form.setValue("student_id", id); setStudentName(s?.full_name ?? ""); }} />}
          </Field>
          <Field label="Tags" hint="Comma separated, e.g. visa, documents" className="sm:col-span-2">{(p) => <Input {...p} {...r("tags")} />}</Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending} data-testid="task-submit">{pending && <Loader2 className="animate-spin" />} Save task</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
