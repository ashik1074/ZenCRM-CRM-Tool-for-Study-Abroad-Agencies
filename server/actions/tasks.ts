"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/server/auth";
import { must, run, type ActionResult } from "@/server/action";
import { csv, nul } from "@/lib/validation/common";
import { commentSchema, sprintSchema, taskSchema, type SprintInput, type TaskInput } from "@/lib/validation/tasks";
import { sanitizeHtml } from "@/lib/sanitize";
import { ALLOWED_MIME, MAX_FILE_BYTES, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";

function revalidate() {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function saveTask(input: TaskInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const v = taskSchema.parse(input);
    const me = await assertPermission("tasks", v.id ? "edit" : "create");
    const row = {
      title: v.title,
      description: v.description ? sanitizeHtml(v.description) : null,
      assignee_id: nul(v.assignee_id) ?? (v.id ? null : me.id),
      priority: v.priority,
      status: v.status,
      due_date: nul(v.due_date),
      sprint_id: nul(v.sprint_id),
      student_id: nul(v.student_id),
      tags: csv(v.tags).map((t) => t.toLowerCase()).slice(0, 10),
    };
    const supabase = createClient();
    const res = v.id
      ? must(await supabase.from("tasks").update(row).eq("id", v.id).select("id").single())
      : must(await supabase.from("tasks").insert({ ...row, reporter_id: me.id }).select("id").single());
    revalidate();
    return res as { id: string };
  }, "Task saved");
}

const quickSchema = z.object({
  id: z.string().uuid(),
  field: z.enum(["status", "assignee_id", "priority"]),
  value: z.string().nullable(),
});

/** Inline row edits from the task list (status dropdown, reassign, priority). */
export async function quickUpdateTask(input: z.input<typeof quickSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("tasks", "edit");
    const v = quickSchema.parse(input);
    if (v.field === "status" && !TASK_STATUSES.some((s) => s.value === v.value)) throw new Error("Unknown status");
    if (v.field === "priority" && !TASK_PRIORITIES.some((s) => s.value === v.value)) throw new Error("Unknown priority");
    if (v.field === "assignee_id" && v.value && !/^[0-9a-f-]{36}$/i.test(v.value)) throw new Error("Unknown user");
    const { data, error } = await createClient().from("tasks").update({ [v.field]: v.value || null }).eq("id", v.id).select("id");
    if (error) throw error;
    if (!data?.length) throw new Error("You can only change tasks assigned to or reported by you.");
    revalidate();
    return null;
  }, "Task updated");
}

export async function deleteTask(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("tasks", "delete");
    must(await createClient().from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", z.string().uuid().parse(id)));
    revalidate();
    return null;
  }, "Task moved to Deleted items");
}

export async function getTaskDetail(id: string) {
  await assertPermission("tasks", "view");
  const supabase = createClient();
  const [{ data: task }, { data: comments }, { data: attachments }, { data: activity }] = await Promise.all([
    supabase
      .from("tasks")
      .select(`*, assignee:profiles!tasks_assignee_id_fkey(id, full_name), reporter:profiles!tasks_reporter_id_fkey(id, full_name),
               sprint:sprints(id, name, status), student:students(id, full_name)`)
      .eq("id", z.string().uuid().parse(id))
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("task_comments").select("id, body, mentions, created_at, author_id, author:profiles!task_comments_author_id_fkey(full_name)").eq("task_id", id).is("deleted_at", null).order("created_at"),
    supabase.from("task_attachments").select("id, file_path, file_name, mime_type, size_bytes, created_at").eq("task_id", id).is("deleted_at", null).order("created_at"),
    supabase.from("task_activity").select("id, action, from_value, to_value, created_at, actor:profiles!task_activity_actor_id_fkey(full_name)").eq("task_id", id).order("created_at", { ascending: false }).limit(50),
  ]);
  return { task, comments: comments ?? [], attachments: attachments ?? [], activity: activity ?? [] };
}

export async function addComment(input: z.input<typeof commentSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const me = await assertPermission("tasks", "view");
    const v = commentSchema.parse(input);
    must(await createClient().from("task_comments").insert({ task_id: v.task_id, body: v.body, mentions: Array.from(new Set(v.mentions)), author_id: me.id }));
    return null;
  }, "Comment added");
}

export async function deleteComment(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("tasks", "view");
    must(await createClient().from("task_comments").update({ deleted_at: new Date().toISOString() }).eq("id", id));
    return null;
  }, "Comment deleted");
}

export async function addTaskAttachment(taskId: string, f: { file_path: string; file_name: string; mime_type: string; size_bytes: number }): Promise<ActionResult<null>> {
  return run(async () => {
    const me = await assertPermission("tasks", "edit");
    if (!f.file_path.startsWith(`${taskId}/`)) throw new Error("Invalid file location.");
    if (!ALLOWED_MIME.includes(f.mime_type) || f.size_bytes > MAX_FILE_BYTES) throw new Error("File type or size not allowed.");
    const supabase = createClient();
    must(await supabase.from("task_attachments").insert({ ...f, task_id: taskId }));
    await supabase.from("task_activity").insert({ task_id: taskId, actor_id: me.id, action: "attachment", to_value: f.file_name });
    return null;
  }, "File attached");
}

export async function deleteTaskAttachment(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("tasks", "edit");
    const supabase = createClient();
    const a = must(await supabase.from("task_attachments").select("file_path").eq("id", id).single()) as { file_path: string };
    must(await supabase.from("task_attachments").delete().eq("id", id));
    await supabase.storage.from("task-attachments").remove([a.file_path]);
    return null;
  }, "Attachment deleted");
}

// ---------------------------------------------------------------------------
// Sprints
// ---------------------------------------------------------------------------
export async function saveSprint(input: SprintInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const v = sprintSchema.parse(input);
    await assertPermission("sprints", v.id ? "edit" : "create");
    const row = { name: v.name, start_date: v.start_date, end_date: v.end_date, status: v.status, goal: nul(v.goal) };
    const supabase = createClient();
    const res = v.id
      ? must(await supabase.from("sprints").update(row).eq("id", v.id).select("id").single())
      : must(await supabase.from("sprints").insert(row).select("id").single());
    revalidate();
    return res as { id: string };
  }, "Sprint saved");
}

/** Complete the active sprint and optionally move its unfinished tasks into another sprint. */
export async function completeSprint(id: string, moveTo: string | null): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("sprints", "edit");
    const supabase = createClient();
    if (moveTo) {
      must(await supabase.from("tasks").update({ sprint_id: moveTo }).eq("sprint_id", id).in("status", ["todo", "in_progress", "in_review"]).is("deleted_at", null));
    }
    must(await supabase.from("sprints").update({ status: "completed" }).eq("id", id));
    revalidate();
    return null;
  }, "Sprint completed");
}
