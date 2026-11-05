"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Field, nativeSelectClass } from "@/components/shared/field";
import { STUDENT_STATUSES } from "@/lib/constants";
import { changeStudentStatus } from "@/server/actions/students";

export function StatusChanger({ id, status }: { id: string; status: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(status);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="outline" onClick={() => { setValue(status); setNote(""); setOpen(true); }}>
        <RefreshCw /> Change status
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change pipeline status</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Field label="New status">
              {(p) => (
                <select className={nativeSelectClass} {...p} value={value} onChange={(e) => setValue(e.target.value)}>
                  {STUDENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              )}
            </Field>
            <Field label="Note (optional)">{(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. JW202 received by courier" />}</Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={pending || value === status}
              onClick={() => start(async () => {
                const r = await changeStudentStatus({ id, status: value, note: note || undefined });
                if (r.ok) { toast.success(r.message); setOpen(false); } else toast.error(r.error);
              })}
            >
              {pending && <Loader2 className="animate-spin" />} Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
