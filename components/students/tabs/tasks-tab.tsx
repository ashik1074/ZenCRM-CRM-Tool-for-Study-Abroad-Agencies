import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import type { CurrentUser } from "@/server/auth";
import { getStaffOptions } from "@/server/queries/students";
import { TASK_SELECT, type TaskRow } from "@/server/queries/tasks";
import { TaskList } from "@/components/tasks/task-list";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { StudentTaskButton } from "./student-task-button";

export async function TasksTab({ studentId, user }: { studentId: string; user: CurrentUser }) {
  if (!can(user.permissions, "tasks", "view")) return <p className="text-sm text-muted-foreground">You don&apos;t have access to tasks.</p>;
  const supabase = createClient();
  const [{ data, count }, { data: sprints }, users, { data: student }] = await Promise.all([
    supabase.from("tasks").select(TASK_SELECT, { count: "exact" }).eq("student_id", studentId).is("deleted_at", null).order("priority_rank").order("due_date", { nullsFirst: false }).limit(100),
    supabase.from("sprints").select("id, name, status").is("deleted_at", null).order("start_date", { ascending: false }),
    getStaffOptions(),
    supabase.from("students").select("full_name").eq("id", studentId).single(),
  ]);
  const options = { users, sprints: (sprints ?? []) as { id: string; name: string; status: string }[] };
  const canEdit = can(user.permissions, "tasks", "edit");
  return (
    <div className="space-y-3">
      {can(user.permissions, "tasks", "create") && <StudentTaskButton options={options} studentId={studentId} studentName={(student as { full_name: string } | null)?.full_name ?? ""} />}
      <TaskList
        rows={(data ?? []) as unknown as TaskRow[]}
        total={count ?? 0}
        page={1}
        pageParam="tpage"
        users={users}
        canEdit={canEdit}
        canEditAll={can(user.permissions, "tasks_all", "edit")}
        meId={user.id}
      />
      <TaskDrawer options={options} perms={{ edit: canEdit, delete: can(user.permissions, "tasks", "delete") }} meId={user.id} />
    </div>
  );
}
