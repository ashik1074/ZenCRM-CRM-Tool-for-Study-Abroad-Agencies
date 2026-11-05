import { requirePagePermission } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { sp, type SearchParams } from "@/lib/url";
import { PageHeader } from "@/components/shared/page-header";
import { getStaffOptions } from "@/server/queries/students";
import { taskSection } from "@/server/queries/tasks";
import { TaskList } from "@/components/tasks/task-list";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { SprintManager } from "@/components/tasks/sprint-manager";
import { TasksToolbar } from "./tasks-toolbar";
import { InactiveSection } from "./inactive-section";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePagePermission("tasks");
  const supabase = createClient();
  const canSeeAll = can(user.permissions, "tasks_all", "view");
  const [{ data: sprintRows }, users] = await Promise.all([
    supabase.from("sprints").select("id, name, start_date, end_date, status, goal").is("deleted_at", null).order("start_date", { ascending: false }),
    getStaffOptions(),
  ]);
  const sprints = (sprintRows ?? []) as { id: string; name: string; start_date: string; end_date: string; status: string; goal: string | null }[];
  const ctx = { meId: user.id, canSeeAll, sprints };
  const [active, backlog, inactive] = await Promise.all([
    taskSection("active", searchParams, ctx),
    taskSection("backlog", searchParams, ctx),
    taskSection("inactive", searchParams, ctx),
  ]);
  const activeSprint = sprints.find((s) => s.status === "active");
  const canEdit = can(user.permissions, "tasks", "edit");
  const canEditAll = can(user.permissions, "tasks_all", "edit");
  const options = { users, sprints };
  const listProps = { users, canEdit, canEditAll, meId: user.id };

  return (
    <>
      <PageHeader
        title="Tasks"
        description={activeSprint ? <>Active sprint: <b>{activeSprint.name}</b> ({fmtDate(activeSprint.start_date)} – {fmtDate(activeSprint.end_date)})</> : "No active sprint"}
        actions={<SprintManager sprints={sprints} canEdit={can(user.permissions, "sprints", "edit")} />}
      />
      <TasksToolbar
        canSeeAll={canSeeAll}
        canCreate={can(user.permissions, "tasks", "create")}
        users={users}
        sprints={sprints}
        options={options}
        scope={canSeeAll ? sp(searchParams, "scope") ?? "mine" : "mine"}
      />
      <section aria-labelledby="active-h" className="space-y-2">
        <h2 id="active-h" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Active sprint <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{active.total}</span>
        </h2>
        <TaskList rows={active.rows} total={active.total} page={active.page} pageParam="page" highlight {...listProps} />
      </section>
      {backlog.total > 0 && (
        <section aria-labelledby="backlog-h" className="mt-6 space-y-2">
          <h2 id="backlog-h" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Backlog & planned sprints ({backlog.total})</h2>
          <TaskList rows={backlog.rows} total={backlog.total} page={backlog.page} pageParam="bpage" {...listProps} />
        </section>
      )}
      <InactiveSection count={inactive.total} defaultOpen={!!sp(searchParams, "ipage")}>
        <TaskList rows={inactive.rows} total={inactive.total} page={inactive.page} pageParam="ipage" {...listProps} />
      </InactiveSection>
      <TaskDrawer options={options} perms={{ edit: canEdit, delete: can(user.permissions, "tasks", "delete") }} meId={user.id} />
    </>
  );
}
