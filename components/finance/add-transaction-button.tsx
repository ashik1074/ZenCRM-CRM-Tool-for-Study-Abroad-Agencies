"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionSheet } from "./transaction-sheet";
import type { TxnPreset } from "./transaction-events";

/** Header "+ Add Transaction" button. Also opens when any page calls openTransactionSheet(). */
export function AddTransactionButton() {
  const [preset, setPreset] = useState<TxnPreset | null>(null);
  useEffect(() => {
    const onOpen = (e: Event) => setPreset((e as CustomEvent<TxnPreset>).detail ?? { type: "income" });
    window.addEventListener("crm:add-transaction", onOpen);
    return () => window.removeEventListener("crm:add-transaction", onOpen);
  }, []);
  return (
    <>
      <Button size="sm" onClick={() => setPreset({ type: "income" })} data-testid="add-transaction">
        <Plus /> <span className="hidden sm:inline">Add Transaction</span>
      </Button>
      {preset && <TransactionSheet preset={preset} onClose={() => setPreset(null)} />}
    </>
  );
}
