"use client";
import { useState } from "react";
import { CircleDollarSign, Plus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeePlanDialog } from "@/components/finance/fee-plan-dialog";
import { openTransactionSheet } from "@/components/finance/transaction-events";
import { downloadMoneyReceipt } from "@/components/finance/money-receipt";

export function PaymentsActions({ studentId, studentName, canCreate, hasPlan }: { studentId: string; studentName: string; canCreate: boolean; hasPlan: boolean }) {
  const [adding, setAdding] = useState(false);
  if (!canCreate) return null;
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline" onClick={() => setAdding(true)}><Plus /> {hasPlan ? "Add another fee plan" : "Create fee plan"}</Button>
      <Button onClick={() => openTransactionSheet("income", { studentId, studentName })}><CircleDollarSign /> Record payment</Button>
      {adding && <FeePlanDialog plan={{ student_id: studentId, student_name: studentName, title: "Full service package", total_amount: "", currency: "BDT", installments: [{ label: "Installment 1", due_date: new Date().toISOString().slice(0, 10), amount: "" }] }} onClose={() => setAdding(false)} />}
    </div>
  );
}

export function ReceiptButton({ id, no }: { id: string; no: string }) {
  return (
    <Button size="sm" variant="ghost" className="h-7" onClick={() => downloadMoneyReceipt(id)} aria-label={`Download money receipt ${no}`}>
      <Receipt /> {no}
    </Button>
  );
}
