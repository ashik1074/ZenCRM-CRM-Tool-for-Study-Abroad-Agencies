"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClearFilters, DateRangeFilter, FilterBar, SearchFilter, SelectFilter } from "@/components/shared/list-filters";
import { useUrlState } from "@/components/shared/use-url-state";
import { StudentPicker } from "@/components/shared/student-picker";
import { TaskFormDialog, type TaskFormOptions } from "@/components/tasks/task-form-dialog";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function TasksToolbar({
  canSeeAll,
  canCreate,
  users,
  sprints,
  options,
  scope,
}: {
  canSeeAll: boolean;
  canCreate: boolean;
  users: { id: string; full_name: string }[];
  sprints: { id: string; name: string }[];
  options: TaskFormOptions;
  scope: string;
}) {
  const { set, get } = useUrlState();
  const [adding, setAdding] = useState(false);
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {canSeeAll ? (
          <div role="group" aria-label="Task scope" className="inline-flex rounded-md border p-0.5">
            {[["mine", "My tasks"], ["all", "All tasks"]].map(([v, l]) => (
              <button
                key={v}
                type="button"
                aria-pressed={scope === v}
                onClick={() => set({ scope: v === "mine" ? null : v, assignee: null })}
                className={cn("rounded px-3 py-1 text-sm", scope === v ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              >
                {l}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Showing your tasks</p>
        )}
        {canCreate && <Button onClick={() => setAdding(true)} data-testid="add-task"><Plus /> Add task</Button>}
      </div>
      <FilterBar>
        <SearchFilter placeholder="Search task title…" />
        {scope === "all" && <SelectFilter param="assignee" label="Assignees" options={users.map((u) => ({ value: u.id, label: u.full_name }))} />}
        <SelectFilter param="status" label="Statuses" options={TASK_STATUSES} width="w-full sm:w-36" />
        <SelectFilter param="priority" label="Priorities" options={TASK_PRIORITIES} width="w-full sm:w-36" />
        <SelectFilter param="sprint" label="Sprints" options={sprints.map((s) => ({ value: s.id, label: s.name }))} />
        <div className="w-full sm:w-56">
          <StudentPicker value={get("student")} placeholder="Linked student…" onChange={(id) => set({ student: id || null })} />
        </div>
        <DateRangeFilter label="Due" />
        <ClearFilters keep={["scope"]} />
      </FilterBar>
      {adding && <TaskFormDialog options={options} onClose={() => setAdding(false)} />}
    </>
  );
}
