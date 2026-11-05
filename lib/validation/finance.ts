import { z } from "zod";
import { CURRENCIES, PAYMENT_METHODS } from "@/lib/constants";
import { money, optStr, optUuid } from "./common";

export const transactionSchema = z
  .object({
    id: optStr(40),
    type: z.enum(["income", "expense"]),
    txn_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
    amount: money(),
    currency: z.enum(CURRENCIES).default("BDT"),
    exchange_rate: z.union([z.string(), z.number()]).refine((v) => Number(v) > 0, "Exchange rate must be greater than 0"),
    category_id: z.string().uuid("Choose a category"),
    student_id: optUuid,
    fee_installment_id: optUuid,
    payment_method: z.enum(PAYMENT_METHODS).default("Cash"),
    reference_no: optStr(100),
    vendor: optStr(200),
    note: optStr(1000),
    receipt_path: optStr(500),
  })
  .refine((v) => v.currency !== "BDT" || Number(v.exchange_rate) === 1, { message: "BDT always uses a rate of 1", path: ["exchange_rate"] });
export type TransactionInput = z.input<typeof transactionSchema>;

export const feePlanSchema = z.object({
  id: optStr(40),
  student_id: z.string().uuid("Choose a student"),
  title: z.string().trim().min(1, "Title is required").max(120),
  total_amount: money("Total"),
  currency: z.enum(CURRENCIES).default("BDT"),
  notes: optStr(1000),
  installments: z
    .array(
      z.object({
        id: optStr(40),
        label: z.string().trim().min(1, "Label is required").max(60),
        due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date is required"),
        amount: money(),
      }),
    )
    .min(1, "Add at least one installment"),
});
export type FeePlanInput = z.input<typeof feePlanSchema>;

export const categorySchema = z.object({
  id: optStr(40),
  type: z.enum(["income", "expense"]),
  name: z.string().trim().min(1, "Name is required").max(80),
  is_archived: z.boolean().default(false),
});
