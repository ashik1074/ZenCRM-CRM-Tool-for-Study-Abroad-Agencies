"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarRange, CheckCircle2, Loader2, Pencil, Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, nativeSelectClass } from "@/components/shared/field";
import { OptionBadge } from "@/components/shared/status-badge";
import { SPRINT_STATUSES } from "@/lib/constants";
import { fmtDate, todayDhaka } from "@/lib/format";
import { completeSprint, saveSprint } from "@/server/actions/tasks";

type Sprint = { id: string; name: string; start_date: string; end_date: string; status: string; goal: string | null };

export function SprintManager({ sprints, canEdit }: { sprints: Sprint[]; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Sprint> | null>(null);
  const [completing, setCompleting] = useState<Sprint | null>(null);
  const active = sprints.find((s) => s.status === "active");

  async function activate(s: Sprint) {
    if (active) {
      toast.error(`Complete "${active.name}" first — only one sprint can be active.`);
      return;
    }
    const r = await saveSprint({ ...s, goal: s.goal ?? "", status: "active" });
    r.ok ? toast.success("Sprint started") : toast.error(r.error);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><CalendarRange /> Sprints</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sprints</DialogTitle>
            <DialogDescription>Only one sprint can be active at a time. Completing a sprint can carry unfinished tasks forward.</DialogDescription>
          </DialogHeader>
          <ul className="max-h-[50vh] divide-y overflow-y-auto rounded-md border">
            {sprints.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(s.start_date)} – {fmtDate(s.end_date)}{s.goal && ` · ${s.goal}`}</p>
                </div>
                <OptionBadge list={SPRINT_STATUSES} value={s.status} />
                {canEdit && (
                  <div className="flex gap-1">
                    {s.status === "planned" && <Button size="sm" variant="outline" onClick={() => activate(s)}><Play /> Start</Button>}
                    {s.status === "active" && <Button size="sm" variant="outline" onClick={() => setCompleting(s)}><CheckCircle2 /> Complete</Button>}
                    <Button size="icon" variant="ghost" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)}><Pencil /></Button>
                  </div>
                )}
              </li>
            ))}
            {sprints.length === 0 && <li className="p-4 text-sm text-muted-foreground">No sprints yet.</li>}
          </ul>
          {canEdit && (
            <DialogFooter>
              <Button onClick={() => setEditing({ name: "", start_date: todayDhaka(), end_date: todayDhaka(), status: "planned", goal: "" })}><Plus /> New sprint</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      {editing && <SprintForm sprint={editing} onClose={() => setEditing(null)} />}
      {completing && <CompleteSprint sprint={completing} others={sprints.filter((s) => s.status === "planned")} onClose={() => setCompleting(null)} />}
    </>
  );
}

function SprintForm({ sprint, onClose }: { sprint: Partial<Sprint>; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ name: sprint.name ?? "", start_date: sprint.start_date ?? "", end_date: sprint.end_date ?? "", goal: sprint.goal ?? "", status: sprint.status ?? "planned" });
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{sprint.id ? "Edit sprint" : "New sprint"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2">{(p) => <Input {...p} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}</Field>
          <Field label="Start date" required>{(p) => <Input type="date" {...p} value={v.start_date} onChange={(e) => setV({ ...v, start_date: e.target.value })} />}</Field>
          <Field label="End date" required>{(p) => <Input type="date" {...p} value={v.end_date} onChange={(e) => setV({ ...v, end_date: e.target.value })} />}</Field>
          <Field label="Status">
            {(p) => (
              <select className={nativeSelectClass} {...p} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>
                {SPRINT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            )}
          </Field>
          <Field label="Goal">{(p) => <Input {...p} value={v.goal} onChange={(e) => setV({ ...v, goal: e.target.value })} />}</Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={pending} onClick={() => start(async () => {
            const r = await saveSprint({ ...v, id: sprint.id ?? "", status: v.status as "planned" });
            if (r.ok) { toast.success(r.message); onClose(); router.refresh(); } else toast.error(r.error);
          })}>{pending && <Loader2 className="animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompleteSprint({ sprint, others, onClose }: { sprint: Sprint; others: Sprint[]; onClose: () => void }) {
  const router = useRouter();
  const [moveTo, setMoveTo] = useState(others[0]?.id ?? "");
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete {sprint.name}?</DialogTitle>
          <DialogDescription>Unfinished tasks (To Do / In Progress / In Review) can move to a planned sprint, or stay in this one and show under Inactive.</DialogDescription>
        </DialogHeader>
        <Field label="Move unfinished tasks to">
          {(p) => (
            <select className={nativeSelectClass} {...p} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              <option value="">Don&apos;t move</option>
              {others.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={pending} onClick={() => start(async () => {
            const r = await completeSprint(sprint.id, moveTo || null);
            if (r.ok) { toast.success(r.message); onClose(); router.refresh(); } else toast.error(r.error);
          })}>{pending && <Loader2 className="animate-spin" />} Complete sprint</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
