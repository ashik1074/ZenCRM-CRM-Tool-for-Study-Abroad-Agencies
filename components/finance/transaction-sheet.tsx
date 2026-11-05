"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Paperclip, Receipt, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Field, nativeSelectClass } from "@/components/shared/field";
import { FileUploader } from "@/components/shared/file-uploader";
import { StudentPicker } from "@/components/shared/student-picker";
import { cn } from "@/lib/utils";
import { CURRENCIES, PAYMENT_METHODS } from "@/lib/constants";
import { fmtDate, fmtMoney, todayDhaka } from "@/lib/format";
import { getFinanceFormData, getStudentInstallments, saveTransaction, type InstallmentOption } from "@/server/actions/finance";
import { downloadMoneyReceipt } from "./money-receipt";
import type { TxnPreset } from "./transaction-events";

type Cat = { id: string; type: "income" | "expense"; name: string; recent: boolean };

export function TransactionSheet({ preset, onClose }: { preset: TxnPreset; onClose: () => void }) {
  const router = useRouter();
  const [id] = useState(() => crypto.randomUUID());
  const [type, setType] = useState<"income" | "expense">(preset.type ?? "income");
  const [cats, setCats] = useState<Cat[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({ BDT: 1 });
  const [installments, setInstallments] = useState<InstallmentOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [v, setV] = useState({
    txn_date: todayDhaka(),
    amount: preset.amount ? String(preset.amount) : "",
    currency: "BDT" as (typeof CURRENCIES)[number],
    exchange_rate: "1",
    category_id: "",
    student_id: preset.studentId ?? "",
    fee_installment_id: preset.installmentId ?? "",
    payment_method: "Cash" as (typeof PAYMENT_METHODS)[number],
    reference_no: "",
    vendor: "",
    note: "",
    receipt_path: "",
    receipt_name: "",
  });
  const [studentName, setStudentName] = useState(preset.studentName ?? "");

  useEffect(() => {
    getFinanceFormData()
      .then((d) => {
        setCats(d.categories as Cat[]);
        setRates(d.rates);
      })
      .catch(() => toast.error("You don't have permission to add transactions."));
  }, []);
  // default category = most recent of this type
  useEffect(() => {
    const first = cats.find((c) => c.type === type);
    setV((x) => (cats.some((c) => c.id === x.category_id && c.type === type) ? x : { ...x, category_id: first?.id ?? "" }));
  }, [type, cats]);
  useEffect(() => {
    if (type === "income" && v.student_id) getStudentInstallments(v.student_id).then(setInstallments).catch(() => setInstallments([]));
    else setInstallments([]);
  }, [v.student_id, type]);

  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((x) => ({ ...x, [k]: val }));
  const bdt = Number(v.amount || 0) * Number(v.exchange_rate || 0);
  const typed = cats.filter((c) => c.type === type);

  function submit(withReceipt: boolean) {
    const errs: Record<string, string> = {};
    if (!(Number(v.amount) > 0)) errs.amount = "Enter an amount greater than 0";
    if (!v.category_id) errs.category_id = "Choose a category";
    if (!v.txn_date) errs.txn_date = "Date is required";
    if (v.currency !== "BDT" && !(Number(v.exchange_rate) > 0)) errs.exchange_rate = "Enter the exchange rate";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    start(async () => {
      const r = await saveTransaction({ ...v, id, type });
      if (!r.ok) {
        toast.error(r.error);
        if (r.fieldErrors) setErrors(Object.fromEntries(Object.entries(r.fieldErrors).map(([k, m]) => [k, m[0]])));
        return;
      }
      toast.success(`${type === "income" ? "Income" : "Expense"} of ${fmtMoney(v.amount, v.currency)} saved`);
      if (withReceipt && r.data.receipt_no) await downloadMoneyReceipt(r.data.id);
      onClose();
      router.refresh();
    });
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md" data-testid="transaction-sheet">
        <SheetHeader>
          <SheetTitle>Add transaction</SheetTitle>
          <SheetDescription>Amounts in other currencies are converted to BDT for reports.</SheetDescription>
        </SheetHeader>
        <form
          className="mt-4 grid gap-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
        >
          <div role="radiogroup" aria-label="Transaction type" className="grid grid-cols-2 rounded-md border p-0.5">
            {(["income", "expense"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={type === t}
                onClick={() => setType(t)}
                className={cn("rounded py-1.5 text-sm font-medium capitalize", type === t ? (t === "income" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground") : "hover:bg-muted")}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_96px] gap-2">
            <Field label="Amount" required error={errors.amount}>
              {(p) => <Input {...p} type="number" inputMode="decimal" min="0" step="0.01" autoFocus value={v.amount} onChange={(e) => set("amount", e.target.value)} data-testid="txn-amount" />}
            </Field>
            <Field label="Currency">
              {(p) => (
                <select
                  className={nativeSelectClass}
                  {...p}
                  value={v.currency}
                  onChange={(e) => {
                    const c = e.target.value as (typeof CURRENCIES)[number];
                    setV((x) => ({ ...x, currency: c, exchange_rate: String(rates[c] ?? (c === "BDT" ? 1 : "")) }));
                  }}
                >
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              )}
            </Field>
          </div>
          {v.currency !== "BDT" && (
            <Field label={`Rate: 1 ${v.currency} = ? BDT`} error={errors.exchange_rate} hint={bdt ? `≈ ${fmtMoney(bdt, "BDT")}` : undefined}>
              {(p) => <Input {...p} type="number" step="0.0001" min="0" value={v.exchange_rate} onChange={(e) => set("exchange_rate", e.target.value)} />}
            </Field>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Date" required error={errors.txn_date}>{(p) => <Input {...p} type="date" value={v.txn_date} onChange={(e) => set("txn_date", e.target.value)} />}</Field>
            <Field label="Payment method">
              {(p) => (
                <select className={nativeSelectClass} {...p} value={v.payment_method} onChange={(e) => set("payment_method", e.target.value as (typeof PAYMENT_METHODS)[number])}>
                  {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              )}
            </Field>
          </div>
          <Field label="Category" required error={errors.category_id}>
            {(p) => (
              <select className={nativeSelectClass} {...p} value={v.category_id} onChange={(e) => set("category_id", e.target.value)} data-testid="txn-category">
                {typed.some((c) => c.recent) && (
                  <optgroup label="Recent">
                    {typed.filter((c) => c.recent).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                )}
                <optgroup label={typed.some((c) => c.recent) ? "All categories" : "Categories"}>
                  {typed.filter((c) => !c.recent).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              </select>
            )}
          </Field>
          {type === "income" ? (
            <>
              <Field label="Student (optional)">
                {(p) => <StudentPicker id={p.id} value={v.student_id} label={studentName} onChange={(sid, s) => { setV((x) => ({ ...x, student_id: sid, fee_installment_id: "" })); setStudentName(s?.full_name ?? ""); }} />}
              </Field>
              {installments.length > 0 && (
                <Field label="Apply to installment" hint="Recording a payment updates the student's balance">
                  {(p) => (
                    <select
                      className={nativeSelectClass}
                      {...p}
                      value={v.fee_installment_id}
                      onChange={(e) => {
                        const inst = installments.find((i) => i.id === e.target.value);
                        setV((x) => ({
                          ...x,
                          fee_installment_id: e.target.value,
                          amount: inst && !x.amount ? String(Math.max(inst.amount - inst.paid_amount, 0)) : x.amount,
                          currency: inst ? (inst.currency as typeof x.currency) : x.currency,
                          exchange_rate: inst ? String(rates[inst.currency] ?? 1) : x.exchange_rate,
                        }));
                      }}
                    >
                      <option value="">Not linked to an installment</option>
                      {installments.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.label} · due {fmtDate(i.due_date)} · {fmtMoney(i.amount - i.paid_amount, i.currency)} left
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              )}
            </>
          ) : (
            <Field label="Vendor / paid to">{(p) => <Input {...p} value={v.vendor} onChange={(e) => set("vendor", e.target.value)} />}</Field>
          )}
          <Field label="Reference / transaction ID">{(p) => <Input {...p} value={v.reference_no} onChange={(e) => set("reference_no", e.target.value)} placeholder="bKash TrxID, cheque no…" />}</Field>
          <Field label="Note">{(p) => <Textarea {...p} rows={2} value={v.note} onChange={(e) => set("note", e.target.value)} />}</Field>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Receipt (optional)</p>
            {v.receipt_path ? (
              <p className="flex items-center justify-between rounded-md border px-2 py-1 text-sm">
                <span className="inline-flex items-center gap-1 truncate"><Paperclip className="h-3 w-3" />{v.receipt_name}</span>
                <Button type="button" size="icon" variant="ghost" aria-label="Remove receipt" onClick={() => setV((x) => ({ ...x, receipt_path: "", receipt_name: "" }))}><X /></Button>
              </p>
            ) : (
              <FileUploader bucket="receipts" folder={id} compact multiple={false} label="Attach receipt photo or PDF" onUploaded={(f) => setV((x) => ({ ...x, receipt_path: f.file_path, receipt_name: f.file_name }))} />
            )}
          </div>
          <SheetFooter className="mt-2 gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            {type === "income" && v.student_id && (
              <Button type="button" variant="outline" disabled={pending} onClick={() => submit(true)}><Receipt /> Save & receipt</Button>
            )}
            <Button type="submit" disabled={pending} data-testid="txn-submit">{pending && <Loader2 className="animate-spin" />} Save</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
