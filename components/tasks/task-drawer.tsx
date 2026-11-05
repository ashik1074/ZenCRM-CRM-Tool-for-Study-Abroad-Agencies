"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FileGallery } from "@/components/shared/file-gallery";
import { FileUploader } from "@/components/shared/file-uploader";
import { RichText } from "@/components/shared/rich-text-editor";
import { OptionBadge } from "@/components/shared/status-badge";
import { TaskFormDialog, type TaskFormOptions } from "./task-form-dialog";
import { DueBadge } from "./task-list";
import { TASK_PRIORITIES, TASK_STATUSES, labelOf } from "@/lib/constants";
import { fmtDateTime, fmtRelative, humanize } from "@/lib/format";
import { addComment, addTaskAttachment, deleteComment, deleteTask, deleteTaskAttachment, getTaskDetail } from "@/server/actions/tasks";

type Detail = Awaited<ReturnType<typeof getTaskDetail>>;
type TaskObj = Record<string, unknown> & {
  id: string; title: string; description: string | null; status: string; priority: string; due_date: string | null; tags: string[];
  sprint_id: string | null; student_id: string | null; assignee_id: string | null;
  assignee: { full_name: string } | null; reporter: { full_name: string } | null; sprint: { name: string } | null; student: { id: string; full_name: string } | null;
  created_at: string;
};

/** Task detail drawer, opened with ?task=<id> on any page that renders it. */
export function TaskDrawer({ options, perms, meId }: { options: TaskFormOptions; perms: { edit: boolean; delete: boolean }; meId: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const id = params.get("task");
  const [data, setData] = useState<Detail | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setData(await getTaskDetail(id));
  }, [id]);
  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const close = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("task");
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const task = data?.task as TaskObj | null | undefined;
  return (
    <>
      <Sheet open={!!id && !editing} onOpenChange={(o) => !o && close()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl" data-testid="task-drawer">
          {!data ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin" /><SheetTitle className="sr-only">Loading task</SheetTitle></div>
          ) : !task ? (
            <SheetHeader><SheetTitle>Task not found</SheetTitle><SheetDescription>It may have been deleted or you don&apos;t have access.</SheetDescription></SheetHeader>
          ) : (
            <div className="space-y-5">
              <SheetHeader className="space-y-2 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <OptionBadge list={TASK_STATUSES} value={task.status} />
                  <OptionBadge list={TASK_PRIORITIES} value={task.priority} />
                  <DueBadge date={task.due_date} status={task.status} />
                </div>
                <SheetTitle className="pr-6 text-xl">{task.title}</SheetTitle>
                <SheetDescription>
                  Assigned to <b>{task.assignee?.full_name ?? "nobody"}</b> · reported by {task.reporter?.full_name ?? "—"} · {fmtDateTime(task.created_at)}
                </SheetDescription>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {task.sprint && <span>Sprint: <b>{task.sprint.name}</b></span>}
                  {task.student && <span>Student: <Link className="text-primary hover:underline" href={`/students/${task.student.id}`}>{task.student.full_name}</Link></span>}
                  {task.tags?.length > 0 && <span>{task.tags.map((t) => `#${t}`).join(" ")}</span>}
                </div>
                <div className="flex gap-2">
                  {perms.edit && <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil /> Edit</Button>}
                  {perms.delete && (
                    <ConfirmDialog
                      trigger={<Button size="sm" variant="outline" className="text-destructive"><Trash2 /> Delete</Button>}
                      title="Delete this task?"
                      description="It moves to Deleted items."
                      onConfirm={async () => {
                        const r = await deleteTask(task.id);
                        if (r.ok) { toast.success(r.message); close(); router.refresh(); } else toast.error(r.error);
                      }}
                    />
                  )}
                </div>
              </SheetHeader>

              <section aria-labelledby="desc-h">
                <h3 id="desc-h" className="mb-1 text-sm font-semibold">Description</h3>
                <RichText html={task.description} />
              </section>

              <section aria-labelledby="att-h" className="space-y-2">
                <h3 id="att-h" className="text-sm font-semibold">Attachments</h3>
                <FileGallery
                  bucket="task-attachments"
                  files={data.attachments as never}
                  canDelete={perms.edit}
                  emptyText="No attachments."
                  onDelete={async (f) => {
                    const r = await deleteTaskAttachment(f.id);
                    r.ok ? toast.success(r.message) : toast.error(r.error);
                    load();
                  }}
                />
                {perms.edit && (
                  <FileUploader bucket="task-attachments" folder={task.id} compact onUploaded={async (f) => {
                    const r = await addTaskAttachment(task.id, f);
                    if (!r.ok) { toast.error(r.error); return false; }
                    load();
                  }} />
                )}
              </section>

              <Comments taskId={task.id} comments={data.comments as never} users={options.users} meId={meId} onChange={load} />

              <section aria-labelledby="hist-h">
                <h3 id="hist-h" className="mb-2 text-sm font-semibold">History</h3>
                <ol className="space-y-1.5 border-l pl-4 text-sm">
                  {(data.activity as unknown as { id: string; action: string; from_value: string | null; to_value: string | null; created_at: string; actor: { full_name: string } | null }[]).map((a) => (
                    <li key={a.id}>
                      <span className="font-medium">{a.actor?.full_name ?? "System"}</span>{" "}
                      {a.action === "created" ? "created the task" :
                        a.action === "comment" ? "commented" :
                        a.action === "attachment" ? <>attached <i>{a.to_value}</i></> :
                        a.action === "status" ? <>changed status {labelOf(TASK_STATUSES, a.from_value)} → <b>{labelOf(TASK_STATUSES, a.to_value)}</b></> :
                        <>changed {humanize(a.action)} {a.from_value ?? "—"} → <b>{a.to_value ?? "—"}</b></>}
                      <span className="ml-1 text-xs text-muted-foreground">{fmtRelative(a.created_at)}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>
      {editing && task && (
        <TaskFormDialog
          options={options}
          studentLabel={task.student?.full_name}
          initial={{
            id: task.id, title: task.title, description: task.description ?? "", assignee_id: task.assignee_id ?? "", priority: task.priority,
            status: task.status, due_date: task.due_date ?? "", sprint_id: task.sprint_id ?? "", student_id: task.student_id ?? "", tags: (task.tags ?? []).join(", "),
          }}
          onClose={() => setEditing(false)}
          onSaved={() => load()}
        />
      )}
    </>
  );
}

type CommentRow = { id: string; body: string; created_at: string; author_id: string; author: { full_name: string } | null };

function Comments({ taskId, comments, users, meId, onChange }: { taskId: string; comments: CommentRow[]; users: { id: string; full_name: string }[]; meId: string; onChange: () => void }) {
  const [body, setBody] = useState("");
  const [mentioned, setMentioned] = useState<Record<string, string>>({}); // name -> id
  const [query, setQuery] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const suggestions = useMemo(() => (query === null ? [] : users.filter((u) => u.full_name.toLowerCase().includes(query.toLowerCase())).slice(0, 6)), [query, users]);

  function onInput(v: string) {
    setBody(v);
    const caret = ref.current?.selectionStart ?? v.length;
    const m = /@([\w .-]{0,30})$/.exec(v.slice(0, caret));
    setQuery(m ? m[1] : null);
  }
  function pick(u: { id: string; full_name: string }) {
    const caret = ref.current?.selectionStart ?? body.length;
    const before = body.slice(0, caret).replace(/@([\w .-]{0,30})$/, `@${u.full_name} `);
    setBody(before + body.slice(caret));
    setMentioned((m) => ({ ...m, [u.full_name]: u.id }));
    setQuery(null);
    ref.current?.focus();
  }
  // highlight @mentions in rendered comments
  const render = (text: string) => {
    const names = users.map((u) => u.full_name).sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!names.length) return text;
    const parts = text.split(new RegExp(`(@(?:${names.join("|")}))`, "g"));
    return parts.map((p, i) => (p.startsWith("@") && names.length ? <span key={i} className="rounded bg-accent px-0.5 font-medium text-accent-foreground">{p}</span> : p));
  };

  return (
    <section aria-labelledby="com-h" className="space-y-3">
      <h3 id="com-h" className="text-sm font-semibold">Comments</h3>
      <ul className="space-y-3">
        {comments.length === 0 && <li className="text-sm text-muted-foreground">No comments yet.</li>}
        {comments.map((c) => (
          <li key={c.id} className="rounded-md border p-3">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span><b className="text-foreground">{c.author?.full_name ?? "Unknown"}</b> · {fmtDateTime(c.created_at)}</span>
              {c.author_id === meId && (
                <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Delete comment" onClick={async () => { await deleteComment(c.id); onChange(); }}><Trash2 className="h-3 w-3" /></Button>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm">{render(c.body)}</p>
          </li>
        ))}
      </ul>
      <div className="relative">
        <Textarea
          ref={ref}
          aria-label="Add a comment"
          placeholder="Write a comment… type @ to mention someone"
          value={body}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={(e) => {
            if (suggestions.length && (e.key === "Enter" || e.key === "Tab")) { e.preventDefault(); pick(suggestions[0]); }
            if (e.key === "Escape") setQuery(null);
          }}
        />
        {suggestions.length > 0 && (
          <ul role="listbox" aria-label="Mention suggestions" className="absolute bottom-full left-0 z-10 mb-1 w-64 rounded-md border bg-popover p-1 shadow-md">
            {suggestions.map((u) => (
              <li key={u.id} role="option" aria-selected={false}>
                <button type="button" className="w-full rounded px-2 py-1 text-left text-sm hover:bg-muted" onClick={() => pick(u)}>{u.full_name}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button
        size="sm"
        disabled={busy || !body.trim()}
        onClick={async () => {
          setBusy(true);
          const ids = Object.entries(mentioned).filter(([name]) => body.includes(`@${name}`)).map(([, id]) => id);
          const r = await addComment({ task_id: taskId, body, mentions: ids });
          setBusy(false);
          if (r.ok) { setBody(""); setMentioned({}); onChange(); } else toast.error(r.error);
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Send />} Comment
      </Button>
    </section>
  );
}
