"use client";

export type TxnPreset = { type?: "income" | "expense"; studentId?: string; studentName?: string; installmentId?: string; amount?: number };

/** Open the global Add Transaction panel from anywhere (header button listens for this). */
export function openTransactionSheet(type: "income" | "expense" = "income", preset: Omit<TxnPreset, "type"> = {}) {
  window.dispatchEvent(new CustomEvent<TxnPreset>("crm:add-transaction", { detail: { type, ...preset } }));
}
