import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import type { CurrentUser } from "@/server/auth";
import { fmtDate, fmtMoney } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FeePlanCard, type FeePlanRow } from "@/components/finance/fee-plan-card";
import { PaymentsActions, ReceiptButton } from "./payments-actions";

export async function PaymentsTab({ studentId, studentName, user }: { studentId: string; studentName: string; user: CurrentUser }) {
  if (!can(user.permissions, "finance", "view")) {
    return <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">Payments are visible to finance roles only.</p>;
  }
  const supabase = createClient();
  const [{ data: plans }, { data: payments }] = await Promise.all([
    supabase
      .from("fee_plans")
      .select("id, title, total_amount, currency, notes, student_id, student:students(id, full_name), installments:fee_installments(id, label, due_date, amount, paid_amount, sort_order)")
      .eq("student_id", studentId)
      .is("deleted_at", null)
      .is("installments.deleted_at", null),
    supabase
      .from("transactions")
      .select("id, txn_date, amount, currency, amount_bdt, payment_method, reference_no, receipt_no, category:transaction_categories(name), installment:fee_installments(label)")
      .eq("student_id", studentId)
      .eq("type", "income")
      .is("deleted_at", null)
      .order("txn_date", { ascending: false }),
  ]);
  const perms = { create: can(user.permissions, "finance", "create"), edit: can(user.permissions, "finance", "edit"), delete: can(user.permissions, "finance", "delete") };
  type P = { id: string; txn_date: string; amount: number; currency: string; amount_bdt: number; payment_method: string; reference_no: string | null; receipt_no: string | null; category: { name: string } | null; installment: { label: string } | null };
  const pays = (payments ?? []) as unknown as P[];
  const totalPaid = pays.reduce((s, p) => s + Number(p.amount_bdt), 0);
  return (
    <div className="space-y-4">
      <PaymentsActions studentId={studentId} studentName={studentName} canCreate={perms.create} hasPlan={(plans ?? []).length > 0} />
      {(plans ?? []).length === 0 && <p className="text-sm text-muted-foreground">No fee plan yet.</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {((plans ?? []) as unknown as FeePlanRow[]).map((p) => <FeePlanCard key={p.id} plan={p} perms={perms} />)}
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Payment history</CardTitle>
          <span className="text-sm text-muted-foreground">Total received {fmtMoney(totalPaid, "BDT")}</span>
        </CardHeader>
        <CardContent className="p-0">
          {pays.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No payments recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr><th className="px-4 py-2 font-medium">Date</th><th className="font-medium">Purpose</th><th className="font-medium">Method</th><th className="text-right font-medium">Amount</th><th className="px-4 text-right font-medium">Receipt</th></tr>
                </thead>
                <tbody>
                  {pays.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-4 py-2">{fmtDate(p.txn_date)}</td>
                      <td>{[p.category?.name, p.installment?.label].filter(Boolean).join(" — ")}</td>
                      <td>{p.payment_method}{p.reference_no && <span className="block text-xs text-muted-foreground">{p.reference_no}</span>}</td>
                      <td className="text-right font-medium">{fmtMoney(p.amount, p.currency)}</td>
                      <td className="px-4 text-right">{p.receipt_no && <ReceiptButton id={p.id} no={p.receipt_no} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">All transactions: <Link className="text-primary hover:underline" href={`/finance/transactions?student=${studentId}`}>open in Finance</Link></p>
    </div>
  );
}
