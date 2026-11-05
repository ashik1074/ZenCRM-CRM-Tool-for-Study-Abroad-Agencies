import Link from "next/link";
import { requirePagePermission } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { resolvePeriod } from "@/lib/period";
import type { SearchParams } from "@/lib/url";
import { fmtMoney } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { PeriodPicker } from "@/components/charts/period-picker";
import { BarChartView, DonutChartView, LineChartView } from "@/components/charts/charts";

export const metadata = { title: "Finance" };

type Fin = {
  period: { income: number; expense: number }; month: { income: number; expense: number }; ytd: { income: number; expense: number };
  outstanding_dues: number;
  monthly: { month: string; income: number; expense: number }[];
  yearly: { year: number; income: number | null; expense: number | null }[];
  expense_by_category: { name: string; amount: number }[];
  top_students: { id: string; name: string; amount: number }[];
};

function Kpi({ label, value, tone, hint }: { label: string; value: number; tone?: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone ?? ""}`}>{fmtMoney(value, "BDT")}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleString("en", { month: "short", year: "2-digit" });

export default async function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission("finance");
  const { period, from, to } = resolvePeriod(searchParams, "last_12");
  const { data, error } = await createClient().rpc("report_finance", { p_from: from, p_to: to });
  if (error) return <p className="text-destructive">Couldn&apos;t load finance data: {error.message}</p>;
  const f = data as Fin;
  const net = (x: { income: number; expense: number }) => Number(x.income) - Number(x.expense);
  return (
    <>
      <PageHeader title="Finance overview" description="All totals in BDT (foreign-currency transactions use the rate recorded on each transaction)." actions={<PeriodPicker period={period} from={from} to={to} />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="This month's income" value={f.month.income} />
        <Kpi label="This month's expense" value={f.month.expense} />
        <Kpi label="This month's net profit" value={net(f.month)} tone={net(f.month) >= 0 ? "text-success" : "text-destructive"} />
        <Kpi label="Outstanding student dues" value={f.outstanding_dues} hint="unpaid installment balances" />
        <Kpi label="YTD income" value={f.ytd.income} />
        <Kpi label="YTD expense" value={f.ytd.expense} />
        <Kpi label="YTD profit" value={net(f.ytd)} tone={net(f.ytd) >= 0 ? "text-success" : "text-destructive"} />
        <Kpi label="Selected period net" value={net(f.period)} hint={`Income ${fmtMoney(f.period.income, "BDT", { compact: true })} · Expense ${fmtMoney(f.period.expense, "BDT", { compact: true })}`} tone={net(f.period) >= 0 ? "text-success" : "text-destructive"} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Monthly income vs expense</CardTitle></CardHeader>
          <CardContent>
            <BarChartView data={f.monthly.map((m) => ({ ...m, label: monthLabel(m.month) }))} xKey="label" series={[{ key: "income", label: "Income" }, { key: "expense", label: "Expense" }]} format="money" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Expense breakdown by category</CardTitle></CardHeader>
          <CardContent><DonutChartView data={f.expense_by_category.map((c) => ({ name: c.name, value: Number(c.amount) }))} format="money" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Yearly revenue trend</CardTitle></CardHeader>
          <CardContent>
            <LineChartView data={f.yearly.map((y) => ({ year: String(y.year), income: Number(y.income ?? 0), expense: Number(y.expense ?? 0) }))} xKey="year" series={[{ key: "income", label: "Revenue" }, { key: "expense", label: "Expense" }]} format="money" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Top-paying students (selected period)</CardTitle></CardHeader>
          <CardContent>
            {f.top_students.length === 0 ? <p className="text-sm text-muted-foreground">No student payments in this period.</p> : (
              <ol className="divide-y">
                {f.top_students.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="w-5 text-muted-foreground">{i + 1}</span>
                    <Link href={`/students/${s.id}?tab=payments`} className="flex-1 font-medium hover:underline">{s.name}</Link>
                    <span className="tabular-nums font-medium">{fmtMoney(s.amount, "BDT")}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
