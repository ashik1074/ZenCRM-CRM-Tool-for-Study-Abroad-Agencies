"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, nativeSelectClass } from "@/components/shared/field";
import { StudentPicker } from "@/components/shared/student-picker";
import { CURRENCIES } from "@/lib/constants";
import { fmtMoney, todayDhaka } from "@/lib/format";
import { saveFeePlan } from "@/server/actions/finance";

export type FeePlanEdit = {
  id?: string; student_id: string; student_name?: string; title: string; total_amount: number | string; currency: string; notes?: string | null;
  installments: { id?: string; label: string; due_date: string; amount: number | string; paid_amount?: number }[];
};

export function FeePlanDialog({ plan, onClose }: { plan: FeePlanEdit | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState<FeePlanEdit>(
    plan ?? { student_id: "", title: "Full service package", total_amount: "", currency: "BDT", installments: [{ label: "Installment 1", due_date: todayDhaka(), amount: "" }] },
  );
  const [studentName, setStudentName] = useState(plan?.student_name ?? "");
  const sum = v.installments.reduce((s, i) => s + Number(i.amount || 0), 0);
  const mismatch = Number(v.total_amount || 0) > 0 && Math.abs(sum - Number(v.total_amount)) > 0.01;

  const split = (n: number) => {
    const total = Number(v.total_amount || 0);
    if (!total || n < 1) return;
    const each = Math.floor((total / n) * 100) / 100;
    setV({
      ...v,
      installments: Array.from({ length: n }, (_, i) => ({
        label: `Installment ${i + 1}`,
        due_date: new Date(Date.now() + i * 30 * 86400000).toISOString().slice(0, 10),
        amount: i === n - 1 ? Math.round((total - each * (n - 1)) * 100) / 100 : each,
      })),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan?.id ? "Edit fee plan" : "New fee plan"}</DialogTitle>
          <DialogDescription>The agreed package for a student, split into installments with due dates.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Student" required className="sm:col-span-2">
            {(p) => plan?.student_id ? <Input {...p} value={studentName} disabled /> : <StudentPicker id={p.id} value={v.student_id} label={studentName} onChange={(id, s) => { setV({ ...v, student_id: id }); setStudentName(s?.full_name ?? ""); }} />}
          </Field>
          <Field label="Package title" required>{(p) => <Input {...p} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />}</Field>
          <div className="grid grid-cols-[1fr_90px] gap-2">
            <Field label="Total amount" required>{(p) => <Input {...p} type="number" min="0" value={v.total_amount} onChange={(e) => setV({ ...v, total_amount: e.target.value })} />}</Field>
            <Field label="Currency">{(p) => <select className={nativeSelectClass} {...p} value={v.currency} onChange={(e) => setV({ ...v, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>}</Field>
          </div>
        </div>
        <fieldset className="space-y-2 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">Installments</legend>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            Split total equally into
            {[1, 2, 3, 4].map((n) => <Button key={n} type="button" size="sm" variant="outline" className="h-7" onClick={() => split(n)}>{n}</Button>)}
          </div>
          {v.installments.map((i, idx) => (
            <div key={idx} className="grid items-end gap-2 sm:grid-cols-[1fr_150px_130px_auto]">
              <Field label="Label">{(p) => <Input {...p} value={i.label} onChange={(e) => setV({ ...v, installments: v.installments.map((x, j) => (j === idx ? { ...x, label: e.target.value } : x)) })} />}</Field>
              <Field label="Due date">{(p) => <Input {...p} type="date" value={i.due_date} onChange={(e) => setV({ ...v, installments: v.installments.map((x, j) => (j === idx ? { ...x, due_date: e.target.value } : x)) })} />}</Field>
              <Field label="Amount">{(p) => <Input {...p} type="number" min="0" value={i.amount} onChange={(e) => setV({ ...v, installments: v.installments.map((x, j) => (j === idx ? { ...x, amount: e.target.value } : x)) })} />}</Field>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${i.label}`} disabled={(i.paid_amount ?? 0) > 0 || v.installments.length === 1}
                onClick={() => setV({ ...v, installments: v.installments.filter((_, j) => j !== idx) })}><Trash2 /></Button>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button type="button" size="sm" variant="outline" onClick={() => setV({ ...v, installments: [...v.installments, { label: `Installment ${v.installments.length + 1}`, due_date: todayDhaka(), amount: "" }] })}><Plus /> Add installment</Button>
            <span className={`text-sm ${mismatch ? "font-medium text-destructive" : "text-muted-foreground"}`}>Sum {fmtMoney(sum, v.currency)}{mismatch && ` ≠ total ${fmtMoney(v.total_amount, v.currency)}`}</span>
          </div>
        </fieldset>
        <Field label="Notes">{(p) => <Textarea {...p} rows={2} value={v.notes ?? ""} onChange={(e) => setV({ ...v, notes: e.target.value })} />}</Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={pending || mismatch || !v.student_id}
            onClick={() => start(async () => {
              const r = await saveFeePlan({
                id: v.id ?? "", student_id: v.student_id, title: v.title, total_amount: v.total_amount, currency: v.currency as "BDT", notes: v.notes ?? "",
                installments: v.installments.map((i) => ({ id: i.id ?? "", label: i.label, due_date: i.due_date, amount: i.amount })),
              });
              if (r.ok) { toast.success(r.message); onClose(); router.refresh(); } else toast.error(r.error);
            })}
          >
            {pending && <Loader2 className="animate-spin" />} Save plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
