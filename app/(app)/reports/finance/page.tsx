import { requirePagePermission } from "@/server/auth";
import { resolvePeriod } from "@/lib/period";
import type { SearchParams } from "@/lib/url";
import { fmtMoney } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { PeriodPicker } from "@/components/charts/period-picker";
import { ReportTable } from "@/components/charts/report-table";
import { BarChartView, DonutChartView } from "@/components/charts/charts";
import { loadFinanceReportRows } from "@/server/queries/finance-report";

export const metadata = { title: "Finance reports" };

export default async function FinanceReportsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission("finance_reports");
  const { period, from, to } = resolvePeriod(searchParams, "year");
  const { columns, rows, report: f } = await loadFinanceReportRows(from, to);
  const net = Number(f.period.income) - Number(f.period.expense);
  return (
    <>
      <PageHeader title="Finance reports" description="Profit & loss for the selected period, in BDT." actions={<PeriodPicker period={period} from={from} to={to} />} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Income", f.period.income, ""], ["Expense", f.period.expense, ""], ["Net profit", net, net >= 0 ? "text-success" : "text-destructive"], ["Outstanding dues (now)", f.outstanding_dues, ""]].map(([l, v, tone]) => (
          <Card key={l as string}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{l}</p><p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{fmtMoney(Number(v), "BDT")}</p></CardContent></Card>
        ))}
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Monthly income vs expense</CardTitle></CardHeader>
          <CardContent><BarChartView data={f.monthly.map((m) => ({ ...m, income: Number(m.income), expense: Number(m.expense) }))} xKey="month" series={[{ key: "income", label: "Income" }, { key: "expense", label: "Expense" }]} format="money" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Income by category</CardTitle></CardHeader>
          <CardContent><DonutChartView data={f.income_by_category.map((c) => ({ name: c.name, value: Number(c.amount) }))} format="money" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Expense by category</CardTitle></CardHeader>
          <CardContent><DonutChartView data={f.expense_by_category.map((c) => ({ name: c.name, value: Number(c.amount) }))} format="money" /></CardContent>
        </Card>
      </div>
      <ReportTable caption="Finance report data" columns={columns} rows={rows} exportHref={`/api/export/report?name=finance&from=${from}&to=${to}`} />
    </>
  );
}
