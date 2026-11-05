"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, MessageSquare, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OptionBadge, StatusBadge } from "@/components/shared/status-badge";
import { useUrlState } from "@/components/shared/use-url-state";
import { TASK_PRIORITIES, TASK_STATUSES, PAGE_SIZE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { daysUntil, fmtDate } from "@/lib/format";
import { quickUpdateTask } from "@/server/actions/tasks";
import type { TaskRow } from "@/server/queries/tasks";

const selectCls = "h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function DueBadge({ date, status }: { date: string | null; status: string }) {
  if (!date) return <span className="text-xs text-muted-foreground">No due date</span>;
  const d = daysUntil(date)!;
  const open = !["done", "rejected"].includes(status);
  if (open && d < 0) return <StatusBadge tone="red">Overdue · {fmtDate(date, "dd MMM")}</StatusBadge>;
  if (open && d === 0) return <StatusBadge tone="amber">Due today</StatusBadge>;
  return <span className="whitespace-nowrap text-xs text-muted-foreground">Due {fmtDate(date, "dd MMM yyyy")}</span>;
}

export function TaskList({
  rows,
  total,
  page,
  pageParam,
  users,
  highlight,
  canEdit,
  meId,
  canEditAll,
}: {
  rows: TaskRow[];
  total: number;
  page: number;
  pageParam: string;
  users: { id: string; full_name: string }[];
  highlight?: boolean;
  canEdit: boolean;
  canEditAll: boolean;
  meId: string;
}) {
  const router = useRouter();
  const { set } = useUrlState();
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function update(id: string, field: "status" | "assignee_id", value: string | null) {
    const r = await quickUpdateTask({ id, field, value });
    r.ok ? toast.success(r.message) : toast.error(r.error);
    router.refresh();
  }

  if (!rows.length) return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No tasks here.</p>;

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {rows.map((t) => {
          const editable = canEdit && (canEditAll || [t.assignee_id, t.reporter_id].includes(meId));
          return (
            <li
              key={t.id}
              data-testid="task-row"
              className={cn(
                "flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center",
                highlight && "border-l-4 border-l-primary bg-primary/[0.04] dark:bg-primary/[0.08]",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <OptionBadge list={TASK_PRIORITIES} value={t.priority} />
                  <Link href={`?task=${t.id}`} scroll={false} className={cn("font-medium hover:underline", t.status === "done" && "text-muted-foreground line-through")}>
                    {t.title}
                  </Link>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <DueBadge date={t.due_date} status={t.status} />
                  {t.sprint && <span>{t.sprint.name}</span>}
                  {t.student && <Link href={`/students/${t.student.id}`} className="text-primary hover:underline">{t.student.full_name}</Link>}
                  {t.tags?.map((tag) => <span key={tag} className="rounded bg-muted px-1.5">#{tag}</span>)}
                  {(t.comments?.[0]?.count ?? 0) > 0 && <span className="inline-flex items-center gap-0.5"><MessageSquare className="h-3 w-3" aria-label="comments" />{t.comments[0].count}</span>}
                  {(t.attachments?.[0]?.count ?? 0) > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip className="h-3 w-3" aria-label="attachments" />{t.attachments[0].count}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editable ? (
                  <>
                    <select aria-label={`Assignee for ${t.title}`} className={cn(selectCls, "w-36")} value={t.assignee_id ?? ""} onChange={(e) => update(t.id, "assignee_id", e.target.value || null)}>
                      <option value="">Unassigned</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>
                    <select aria-label={`Status of ${t.title}`} data-testid="task-status" className={cn(selectCls, "w-32")} value={t.status} onChange={(e) => update(t.id, "status", e.target.value)}>
                      {TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </>
                ) : (
                  <>
                    <span className="text-xs">{t.assignee?.full_name ?? "Unassigned"}</span>
                    <OptionBadge list={TASK_STATUSES} value={t.status} />
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span>{total} tasks · page {page} of {pages}</span>
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => set({ [pageParam]: String(page - 1) }, { resetPage: false })} aria-label="Previous page"><ChevronLeft /></Button>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => set({ [pageParam]: String(page + 1) }, { resetPage: false })} aria-label="Next page"><ChevronRight /></Button>
        </div>
      )}
    </div>
  );
}
