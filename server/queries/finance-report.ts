import "server-only";
import { createClient } from "@/lib/supabase/server";

export type FinanceReport = {
  period: { income: number; expense: number };
  monthly: { month: string; income: number; expense: number }[];
  expense_by_category: { name: string; amount: number }[];
  income_by_category: { name: string; amount: number }[];
  top_students: { id: string; name: string; amount: number }[];
  outstanding_dues: number;
};

export async function loadFinanceReport(from: string, to: string): Promise<FinanceReport> {
  const { data, error } = await createClient().rpc("report_finance", { p_from: from, p_to: to });
  if (error) throw error;
  return data as FinanceReport;
}

/** Flat rows for the table/export: one row per month + category breakdown. */
export async function loadFinanceReportRows(from: string, to: string) {
  const f = await loadFinanceReport(from, to);
  const rows: Record<string, string | number>[] = [
    ...f.monthly.map((m) => ({ section: "Monthly", label: m.month, income: Number(m.income), expense: Number(m.expense), net: Number(m.income) - Number(m.expense) })),
    ...f.income_by_category.map((c) => ({ section: "Income by category", label: c.name, income: Number(c.amount), expense: 0, net: Number(c.amount) })),
    ...f.expense_by_category.map((c) => ({ section: "Expense by category", label: c.name, income: 0, expense: Number(c.amount), net: -Number(c.amount) })),
    { section: "Total", label: `${from} to ${to}`, income: Number(f.period.income), expense: Number(f.period.expense), net: Number(f.period.income) - Number(f.period.expense) },
  ];
  return {
    columns: [
      { key: "section", label: "Section" }, { key: "label", label: "Month / category" },
      { key: "income", label: "Income (BDT)", numeric: true }, { key: "expense", label: "Expense (BDT)", numeric: true }, { key: "net", label: "Net (BDT)", numeric: true },
    ],
    rows,
    report: f,
  };
}
