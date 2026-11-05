"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/server/auth";
import { must, run, type ActionResult } from "@/server/action";
import { nul } from "@/lib/validation/common";
import { categorySchema, feePlanSchema, transactionSchema, type FeePlanInput, type TransactionInput } from "@/lib/validation/finance";

function revalidate(studentId?: string | null) {
  revalidatePath("/finance", "layout");
  revalidatePath("/dashboard");
  if (studentId) revalidatePath(`/students/${studentId}`);
}

export type Category = { id: string; type: "income" | "expense"; name: string; is_archived: boolean; sort_order: number };

/** Data for the Add Transaction panel: categories (recently used first) and latest exchange rates. */
export async function getFinanceFormData() {
  const me = await assertPermission("finance", "create");
  const supabase = createClient();
  const [{ data: cats }, { data: recent }, { data: rates }] = await Promise.all([
    supabase.from("transaction_categories").select("id, type, name, is_archived, sort_order").is("deleted_at", null).eq("is_archived", false).order("sort_order"),
    supabase.from("transactions").select("category_id").eq("created_by", me.id).order("created_at", { ascending: false }).limit(40),
    supabase.from("exchange_rates").select("currency, rate_to_bdt, effective_date").is("deleted_at", null).order("effective_date", { ascending: false }),
  ]);
  const recentIds = Array.from(new Set((recent ?? []).map((r: { category_id: string }) => r.category_id)));
  const rank = (id: string) => (recentIds.includes(id) ? recentIds.indexOf(id) : 1000);
  const categories = ((cats ?? []) as Category[]).sort((a, b) => rank(a.id) - rank(b.id) || a.sort_order - b.sort_order).map((c) => ({ ...c, recent: recentIds.includes(c.id) }));
  const latest: Record<string, number> = { BDT: 1 };
  for (const r of (rates ?? []) as { currency: string; rate_to_bdt: number }[]) if (!(r.currency in latest)) latest[r.currency] = Number(r.rate_to_bdt);
  return { categories, rates: latest };
}

export type InstallmentOption = { id: string; label: string; due_date: string; amount: number; paid_amount: number; currency: string; plan: string };

export async function getStudentInstallments(studentId: string): Promise<InstallmentOption[]> {
  await assertPermission("finance", "view");
  const { data } = await createClient()
    .from("fee_installments")
    .select("id, label, due_date, amount, paid_amount, plan:fee_plans!inner(title, currency, student_id, deleted_at)")
    .eq("plan.student_id", z.string().uuid().parse(studentId))
    .is("plan.deleted_at", null)
    .is("deleted_at", null)
    .order("due_date");
  return ((data ?? []) as unknown as { id: string; label: string; due_date: string; amount: number; paid_amount: number; plan: { title: string; currency: string } }[]).map((i) => ({
    id: i.id, label: i.label, due_date: i.due_date, amount: Number(i.amount), paid_amount: Number(i.paid_amount), currency: i.plan.currency, plan: i.plan.title,
  }));
}

export async function saveTransaction(input: TransactionInput): Promise<ActionResult<{ id: string; receipt_no: string | null }>> {
  return run(async () => {
    const v = transactionSchema.parse(input);
    const supabase = createClient();
    // the panel sends a client-generated id (receipt uploads go under it); decide create vs edit by existence
    const isUuid = /^[0-9a-f-]{36}$/i.test(v.id ?? "");
    const existing = isUuid ? (await supabase.from("transactions").select("id").eq("id", v.id!).maybeSingle()).data : null;
    await assertPermission("finance", existing ? "edit" : "create");
    const cat = must(await supabase.from("transaction_categories").select("type").eq("id", v.category_id).single()) as { type: string };
    if (cat.type !== v.type) throw new Error("That category doesn't match the transaction type.");
    const row = {
      type: v.type,
      txn_date: v.txn_date,
      amount: Number(v.amount),
      currency: v.currency,
      exchange_rate: v.currency === "BDT" ? 1 : Number(v.exchange_rate),
      category_id: v.category_id,
      student_id: v.type === "income" ? nul(v.student_id) : null,
      fee_installment_id: v.type === "income" ? nul(v.fee_installment_id) : null,
      payment_method: v.payment_method,
      reference_no: nul(v.reference_no),
      vendor: v.type === "expense" ? nul(v.vendor) : null,
      note: nul(v.note),
      receipt_path: nul(v.receipt_path),
    };
    const saved = (existing
      ? must(await supabase.from("transactions").update(row).eq("id", v.id!).select("id, receipt_no").single())
      : must(await supabase.from("transactions").insert({ ...row, id: isUuid ? v.id : undefined }).select("id, receipt_no").single())) as { id: string; receipt_no: string | null };
    revalidate(row.student_id);
    return saved;
  }, "Transaction saved");
}

export async function deleteTransaction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("finance", "delete");
    const t = must(await createClient().from("transactions").update({ deleted_at: new Date().toISOString() }).eq("id", z.string().uuid().parse(id)).select("student_id").single()) as { student_id: string | null };
    revalidate(t.student_id);
    return null;
  }, "Transaction moved to Deleted items");
}

const inlineSchema = z.object({
  id: z.string().uuid(),
  field: z.enum(["txn_date", "amount", "payment_method", "reference_no", "note", "category_id"]),
  value: z.string().max(1000),
});

/** Inline edits from the transactions table. */
export async function updateTransactionField(input: z.input<typeof inlineSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("finance", "edit");
    const v = inlineSchema.parse(input);
    let value: string | number | null = v.value.trim() || null;
    if (v.field === "amount") {
      value = Number(v.value);
      if (!(value > 0)) throw new Error("Amount must be greater than 0");
    }
    if (v.field === "txn_date" && !/^\d{4}-\d{2}-\d{2}$/.test(v.value)) throw new Error("Use a valid date");
    if (v.field === "payment_method" && !["Cash", "bKash", "Nagad", "Bank Transfer", "Card"].includes(v.value)) throw new Error("Unknown payment method");
    must(await createClient().from("transactions").update({ [v.field]: value }).eq("id", v.id));
    revalidate();
    return null;
  }, "Saved");
}

/** Everything needed to render a money receipt PDF. */
export async function getReceiptData(id: string) {
  await assertPermission("finance", "view");
  const supabase = createClient();
  const { data } = await supabase
    .from("transactions")
    .select("id, receipt_no, txn_date, amount, currency, exchange_rate, amount_bdt, payment_method, reference_no, note, category:transaction_categories(name), student:students(full_name, student_code, phone), installment:fee_installments(label), creator:profiles!transactions_created_by_fkey(full_name)")
    .eq("id", z.string().uuid().parse(id))
    .eq("type", "income")
    .single();
  const { data: agency } = await supabase.from("settings").select("value").eq("key", "agency").maybeSingle();
  return { txn: data, agency: (agency?.value ?? { name: "ZenCRM" }) as { name: string; phone?: string; email?: string; address?: string } };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export async function saveCategory(input: z.input<typeof categorySchema>): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("finance_categories", "edit");
    const v = categorySchema.parse(input);
    const supabase = createClient();
    if (v.id) must(await supabase.from("transaction_categories").update({ name: v.name, is_archived: v.is_archived }).eq("id", v.id));
    else must(await supabase.from("transaction_categories").insert({ type: v.type, name: v.name, sort_order: 50 }));
    revalidatePath("/finance/categories");
    return null;
  }, "Category saved");
}

// ---------------------------------------------------------------------------
// Fee plans
// ---------------------------------------------------------------------------
export async function saveFeePlan(input: FeePlanInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const v = feePlanSchema.parse(input);
    await assertPermission("finance", v.id ? "edit" : "create");
    const sum = v.installments.reduce((s, i) => s + Number(i.amount), 0);
    if (Math.abs(sum - Number(v.total_amount)) > 0.01) throw new Error(`Installments add up to ${sum.toFixed(2)}, but the package total is ${Number(v.total_amount).toFixed(2)}.`);
    const supabase = createClient();
    const row = { student_id: v.student_id, title: v.title, total_amount: Number(v.total_amount), currency: v.currency, notes: nul(v.notes) };
    const plan = (v.id
      ? must(await supabase.from("fee_plans").update(row).eq("id", v.id).select("id").single())
      : must(await supabase.from("fee_plans").insert(row).select("id").single())) as { id: string };
    const existing = (must(await supabase.from("fee_installments").select("id, paid_amount").eq("fee_plan_id", plan.id).is("deleted_at", null)) as { id: string; paid_amount: number }[]);
    const keep = new Set(v.installments.map((i) => i.id).filter(Boolean));
    const removed = existing.filter((e) => !keep.has(e.id));
    if (removed.some((r) => Number(r.paid_amount) > 0)) throw new Error("An installment with payments can't be removed. Edit its amount instead.");
    if (removed.length) must(await supabase.from("fee_installments").delete().in("id", removed.map((r) => r.id)));
    for (const [i, inst] of v.installments.entries()) {
      const data = { label: inst.label, due_date: inst.due_date, amount: Number(inst.amount), sort_order: i };
      if (inst.id && existing.some((e) => e.id === inst.id)) must(await supabase.from("fee_installments").update(data).eq("id", inst.id));
      else must(await supabase.from("fee_installments").insert({ ...data, fee_plan_id: plan.id }));
    }
    revalidate(v.student_id);
    return plan;
  }, "Fee plan saved");
}

export async function deleteFeePlan(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("finance", "delete");
    const p = must(await createClient().from("fee_plans").update({ deleted_at: new Date().toISOString() }).eq("id", id).select("student_id").single()) as { student_id: string };
    revalidate(p.student_id);
    return null;
  }, "Fee plan deleted");
}
