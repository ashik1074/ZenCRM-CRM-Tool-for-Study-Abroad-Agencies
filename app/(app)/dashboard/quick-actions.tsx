"use client";
import Link from "next/link";
import { useState } from "react";
import { FileBadge, ListPlus, UserPlus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskFormDialog, type TaskFormOptions } from "@/components/tasks/task-form-dialog";
import { openTransactionSheet } from "@/components/finance/transaction-events";

export function QuickActions({ options, can }: { options: TaskFormOptions; can: { student: boolean; task: boolean; offer: boolean; finance: boolean } }) {
  const [task, setTask] = useState(false);
  return (
    <div className="flex flex-wrap gap-2" aria-label="Quick actions">
      {can.student && <Button asChild variant="outline"><Link href="/students/new"><UserPlus /> Enroll student</Link></Button>}
      {can.task && <Button variant="outline" onClick={() => setTask(true)}><ListPlus /> Add task</Button>}
      {can.offer && <Button asChild variant="outline"><Link href="/offers?new=1"><FileBadge /> Add offer</Link></Button>}
      {can.finance && (
        <>
          <Button variant="outline" onClick={() => openTransactionSheet("income")}><Wallet /> Add income</Button>
          <Button variant="outline" onClick={() => openTransactionSheet("expense")}><Wallet /> Add expense</Button>
        </>
      )}
      {task && <TaskFormDialog options={options} onClose={() => setTask(false)} />}
    </div>
  );
}
