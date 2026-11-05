import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ilikeTerm, sp, type SearchParams } from "@/lib/url";
import { PAGE_SIZE } from "@/lib/constants";

export const TASK_SELECT = `id, title, status, priority, due_date, tags, sprint_id, student_id, assignee_id, reporter_id, created_at,
  assignee:profiles!tasks_assignee_id_fkey(id, full_name), sprint:sprints(id, name, status), student:students(id, full_name),
  comments:task_comments(count), attachments:task_attachments(count)`;

export type TaskRow = {
  id: string; title: string; status: string; priority: string; due_date: string | null; tags: string[];
  sprint_id: string | null; student_id: string | null; assignee_id: string | null; reporter_id: string | null; created_at: string;
  assignee: { id: string; full_name: string } | null;
  sprint: { id: string; name: string; status: string } | null;
  student: { id: string; full_name: string } | null;
  comments: { count: number }[]; attachments: { count: number }[];
};

type Section = "active" | "backlog" | "inactive";

/** One section of the task list with all filters applied. */
export async function taskSection(section: Section, params: SearchParams, ctx: { meId: string; canSeeAll: boolean; sprints: { id: string; status: string }[] }) {
  const supabase = createClient();
  const pageKey = section === "active" ? "page" : section === "backlog" ? "bpage" : "ipage";
  const page = Math.max(1, Number(sp(params, pageKey) ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let q = supabase.from("tasks").select(TASK_SELECT, { count: "exact" }).is("deleted_at", null);

  const scope = ctx.canSeeAll ? sp(params, "scope") ?? "mine" : "mine";
  if (scope === "mine") q = q.eq("assignee_id", ctx.meId);
  if (sp(params, "assignee") && scope === "all") q = q.eq("assignee_id", sp(params, "assignee")!);
  if (sp(params, "status")) q = q.eq("status", sp(params, "status")!);
  if (sp(params, "priority")) q = q.eq("priority", sp(params, "priority")!);
  if (sp(params, "sprint")) q = q.eq("sprint_id", sp(params, "sprint")!);
  if (sp(params, "student")) q = q.eq("student_id", sp(params, "student")!);
  if (sp(params, "from")) q = q.gte("due_date", sp(params, "from")!);
  if (sp(params, "to")) q = q.lte("due_date", sp(params, "to")!);
  if (sp(params, "q")) q = q.ilike("title", ilikeTerm(sp(params, "q")!));

  const active = ctx.sprints.find((s) => s.status === "active")?.id;
  const completed = ctx.sprints.filter((s) => s.status === "completed").map((s) => s.id);
  const planned = ctx.sprints.filter((s) => s.status === "planned").map((s) => s.id);
  const live = ["todo", "in_progress", "in_review", "done"];
  const none = "00000000-0000-0000-0000-000000000000";

  if (section === "active") {
    q = q.eq("sprint_id", active ?? none).in("status", live).order("priority_rank").order("due_date", { ascending: true, nullsFirst: false });
  } else if (section === "backlog") {
    q = q.in("status", live).or(`sprint_id.is.null,sprint_id.in.(${[none, ...planned].join(",")})`).order("priority_rank").order("due_date", { ascending: true, nullsFirst: false });
  } else {
    q = q.or(`status.in.(paused,rejected),sprint_id.in.(${[none, ...completed].join(",")})`).order("updated_at", { ascending: false });
  }
  const { data, count, error } = await q.range(from, from + PAGE_SIZE - 1);
  if (error) console.error("[tasks]", section, error.message);
  return { rows: (data ?? []) as unknown as TaskRow[], total: count ?? 0, page };
}
