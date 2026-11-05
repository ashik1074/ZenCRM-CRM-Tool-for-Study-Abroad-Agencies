"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CircleDollarSign, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { openTransactionSheet } from "./transaction-events";
import { FeePlanDialog } from "./fee-plan-dialog";
import { daysUntil, fmtDate, fmtMoney } from "@/lib/format";
import { deleteFeePlan } from "@/server/actions/finance";

export type FeePlanRow = {
  id: string; title: string; total_amount: number; currency: string; notes: string | null; student_id: string;
  student: { id: string; full_name: string } | null;
  installments: { id: string; label: string; due_date: string; amount: number; paid_amount: number; sort_order: number }[];
};

export function planTotals(p: FeePlanRow) {
  const paid = p.installments.reduce((s, i) => s + Number(i.paid_amount), 0);
  const overdue = p.installments.filter((i) => (daysUntil(i.due_date) ?? 0) < 0 && Number(i.paid_amount) < Number(i.amount)).reduce((s, i) => s + Number(i.amount) - Number(i.paid_amount), 0);
  return { paid, due: Number(p.total_amount) - paid, overdue };
}

export function FeePlanCard({ plan, perms, showStudent }: { plan: FeePlanRow; perms: { create: boolean; edit: boolean; delete: boolean }; showStudent?: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const { paid, due, overdue } = planTotals(plan);
  const pct = plan.total_amount ? Math.min(100, Math.round((paid / Number(plan.total_amount)) * 100)) : 0;
  const insts = [...plan.installments].sort((a, b) => a.sort_order - b.sort_order);
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
        <div>
          <CardTitle className="text-base">
            {showStudent && plan.student ? <Link href={`/students/${plan.student.id}?tab=payments`} className="text-primary hover:underline">{plan.student.full_name}</Link> : plan.title}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{showStudent ? plan.title + " · " : ""}Total {fmtMoney(plan.total_amount, plan.currency)}</p>
        </div>
        <div className="flex items-center gap-1">
          {overdue > 0 ? <StatusBadge tone="red">Overdue {fmtMoney(overdue, plan.currency)}</StatusBadge> : due <= 0 ? <StatusBadge tone="green">Fully paid</StatusBadge> : null}
          {perms.edit && <Button size="icon" variant="ghost" aria-label="Edit fee plan" onClick={() => setEditing(true)}><Pencil /></Button>}
          {perms.delete && (
            <ConfirmDialog trigger={<Button size="icon" variant="ghost" aria-label="Delete fee plan"><Trash2 className="text-destructive" /></Button>} title="Delete this fee plan?" description="Payments already recorded stay in Transactions."
              onConfirm={async () => { const r = await deleteFeePlan(plan.id); r.ok ? toast.success(r.message) : toast.error(r.error); router.refresh(); }} />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span>Paid <b className="text-success">{fmtMoney(paid, plan.currency)}</b></span>
            <span>Balance <b className={due > 0 ? "" : "text-success"}>{fmtMoney(Math.max(due, 0), plan.currency)}</b></span>
          </div>
          <Progress value={pct} aria-label={`${pct}% paid`} />
        </div>
        <table className="w-full text-sm">
          <caption className="sr-only">Installments</caption>
          <thead className="text-left text-xs text-muted-foreground">
            <tr><th className="py-1 font-medium">Installment</th><th className="font-medium">Due</th><th className="text-right font-medium">Amount</th><th className="text-right font-medium">Paid</th><th /></tr>
          </thead>
          <tbody>
            {insts.map((i) => {
              const left = Number(i.amount) - Number(i.paid_amount);
              const late = left > 0 && (daysUntil(i.due_date) ?? 0) < 0;
              return (
                <tr key={i.id} className="border-t">
                  <td className="py-1.5">{i.label}</td>
                  <td className={late ? "font-medium text-destructive" : ""}>{fmtDate(i.due_date)}{late && " (overdue)"}</td>
                  <td className="text-right">{fmtMoney(i.amount, plan.currency)}</td>
                  <td className="text-right">{left <= 0 ? <StatusBadge tone="green">Paid</StatusBadge> : fmtMoney(i.paid_amount, plan.currency)}</td>
                  <td className="text-right">
                    {left > 0 && perms.create && (
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => openTransactionSheet("income", { studentId: plan.student_id, studentName: plan.student?.full_name, installmentId: i.id, amount: left })}>
                        <CircleDollarSign /> Record
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {plan.notes && <p className="text-xs text-muted-foreground">{plan.notes}</p>}
      </CardContent>
      {editing && (
        <FeePlanDialog
          plan={{ ...plan, student_name: plan.student?.full_name, installments: insts.map((i) => ({ id: i.id, label: i.label, due_date: i.due_date, amount: i.amount, paid_amount: i.paid_amount })) }}
          onClose={() => setEditing(false)}
        />
      )}
    </Card>
  );
}
