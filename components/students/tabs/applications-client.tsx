"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { FileBadge, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { OptionBadge } from "@/components/shared/status-badge";
import { APPLICATION_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { fmtDate, todayDhaka } from "@/lib/format";
import { applyToOffer, deleteApplication, setApplicationStatus } from "@/server/actions/offers";

export type AppRow = {
  id: string;
  status: string;
  applied_at: string;
  decision_at: string | null;
  notes: string | null;
  offer: { id: string; title: string; program: string; degree_level: string; intake: string | null; scholarship_type: string | null };
  university: { name: string; city: string | null };
};
type OfferOpt = { id: string; title: string; program: string; intake: string | null; application_deadline: string | null; university: { name: string } };

export function ApplicationsClient({ studentId, apps, offers, perms }: { studentId: string; apps: AppRow[]; offers: OfferOpt[]; perms: { create: boolean; edit: boolean; delete: boolean } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      {perms.create && (
        <div className="flex justify-end">
          <Button onClick={() => setOpen(true)}><Plus /> Apply to offer</Button>
        </div>
      )}
      {apps.length === 0 ? (
        <EmptyState icon={FileBadge} title="No applications yet" description="Apply this student to an open university offer." action={perms.create && <Button onClick={() => setOpen(true)}><Plus /> Apply to offer</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {apps.map((a) => (
            <Card key={a.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/offers?offer=${a.offer.id}&status=all`} className="font-medium text-primary hover:underline">{a.offer.title}</Link>
                    <p className="text-sm text-muted-foreground">{a.university.name}{a.university.city ? `, ${a.university.city}` : ""}</p>
                    <p className="text-xs text-muted-foreground">{[a.offer.degree_level, a.offer.program, a.offer.intake, a.offer.scholarship_type].filter(Boolean).join(" · ")}</p>
                  </div>
                  <OptionBadge list={APPLICATION_STATUSES} value={a.status} />
                </div>
                <p className="text-xs text-muted-foreground">Applied {fmtDate(a.applied_at)}{a.decision_at && ` · Decision ${fmtDate(a.decision_at)}`}</p>
                {a.notes && <p className="text-sm">{a.notes}</p>}
                <div className="flex items-center gap-2">
                  {perms.edit && (
                    <select
                      aria-label="Application status"
                      className="h-8 rounded-md border bg-background px-2 text-sm"
                      value={a.status}
                      onChange={async (e) => {
                        const r = await setApplicationStatus({ id: a.id, status: e.target.value });
                        r.ok ? toast.success(r.message) : toast.error(r.error);
                        router.refresh();
                      }}
                    >
                      {APPLICATION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  )}
                  {perms.delete && (
                    <ConfirmDialog
                      trigger={<Button size="sm" variant="ghost" className="ml-auto text-destructive"><Trash2 /> Remove</Button>}
                      title="Remove this application?"
                      onConfirm={async () => {
                        const r = await deleteApplication(a.id);
                        r.ok ? toast.success(r.message) : toast.error(r.error);
                        router.refresh();
                      }}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {open && <ApplyDialog studentId={studentId} offers={offers.filter((o) => !apps.some((a) => a.offer.id === o.id))} onClose={() => setOpen(false)} />}
    </div>
  );
}

function ApplyDialog({ studentId, offers, onClose }: { studentId: string; offers: OfferOpt[]; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [offerId, setOfferId] = useState("");
  const [appliedAt, setAppliedAt] = useState(todayDhaka());
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  const list = useMemo(() => {
    const t = q.toLowerCase();
    return offers.filter((o) => !t || `${o.title} ${o.program} ${o.university.name} ${o.intake}`.toLowerCase().includes(t)).slice(0, 50);
  }, [offers, q]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Apply to offer</DialogTitle>
          <DialogDescription>Only open offers are listed.</DialogDescription>
        </DialogHeader>
        <Input aria-label="Search offers" placeholder="Search offer, program, university…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <ul role="listbox" aria-label="Open offers" className="max-h-64 divide-y overflow-y-auto rounded-md border">
          {list.length === 0 && <li className="p-3 text-sm text-muted-foreground">No open offers match.</li>}
          {list.map((o) => (
            <li key={o.id} role="option" aria-selected={offerId === o.id}>
              <button type="button" onClick={() => setOfferId(o.id)} className={cn("w-full p-3 text-left text-sm hover:bg-muted", offerId === o.id && "bg-accent")}>
                <p className="font-medium">{o.title}</p>
                <p className="text-xs text-muted-foreground">{o.university.name} · {o.program}{o.intake && ` · ${o.intake}`} · deadline {fmtDate(o.application_deadline)}</p>
              </button>
            </li>
          ))}
        </ul>
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <Field label="Applied on">{(p) => <Input type="date" {...p} value={appliedAt} onChange={(e) => setAppliedAt(e.target.value)} />}</Field>
          <Field label="Notes">{(p) => <Textarea rows={1} {...p} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!offerId || pending}
            onClick={() => start(async () => {
              const r = await applyToOffer({ student_id: studentId, offer_id: offerId, applied_at: appliedAt, notes });
              if (r.ok) { toast.success(r.message); onClose(); router.refresh(); } else toast.error(r.error);
            })}
          >
            {pending && <Loader2 className="animate-spin" />} Create application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
