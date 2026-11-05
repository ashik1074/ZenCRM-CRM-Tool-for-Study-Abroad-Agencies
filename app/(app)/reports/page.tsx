import Link from "next/link";
import { requirePagePermission } from "@/server/auth";
import { loadReport, REPORTS, type ReportName } from "@/server/queries/reports";
import { resolvePeriod } from "@/lib/period";
import { sp, type SearchParams } from "@/lib/url";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { PeriodPicker } from "@/components/charts/period-picker";
import { ReportTable } from "@/components/charts/report-table";
import { BarChartView, DonutChartView, LineChartView } from "@/components/charts/charts";
import { GrainToggle } from "./grain-toggle";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission("reports");
  const tab = (Object.keys(REPORTS).includes(sp(searchParams, "tab") ?? "") ? sp(searchParams, "tab") : "university") as ReportName;
  const { period, from, to } = resolvePeriod(searchParams, "year");
  const grain = sp(searchParams, "grain") === "year" ? "year" : "month";
  const report = await loadReport(tab, from, to, grain);
  const keep = new URLSearchParams(Object.entries(searchParams).filter(([k, v]) => k !== "tab" && typeof v === "string") as [string, string][]).toString();
  const exportHref = `/api/export/report?name=${tab}&from=${from}&to=${to}&grain=${grain}`;
  const num = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "string" && /^\d+(\.\d+)?$/.test(v) ? Number(v) : v]));
  const rows = report.rows.map(num);

  return (
    <>
      <PageHeader title="Reports" actions={<PeriodPicker period={period} from={from} to={to} />} />
      <nav aria-label="Report types" className="-mx-3 mb-4 overflow-x-auto px-3">
        <ul className="flex w-max gap-1 border-b">
          {(Object.entries(REPORTS) as [ReportName, string][]).map(([k, label]) => (
            <li key={k}>
              <Link href={`/reports?tab=${k}${keep ? `&${keep}` : ""}`} aria-current={tab === k ? "page" : undefined}
                className={cn("-mb-px inline-block border-b-2 px-3 py-2 text-sm font-medium", tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Card className="mb-4">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-base">{REPORTS[tab]}</CardTitle>
          {tab === "enrollment" && <GrainToggle grain={grain} />}
        </CardHeader>
        <CardContent>
          {tab === "university" && (
            <BarChartView horizontal data={rows.filter((r) => Number(r.applications) > 0).slice(0, 15)} xKey="university"
              series={[{ key: "applications", label: "Applications" }, { key: "accepted", label: "Acceptances" }, { key: "rejected", label: "Rejections" }, { key: "enrolled", label: "Enrolled" }]} />
          )}
          {tab === "enrollment" && <LineChartView data={rows} xKey="period" series={[{ key: "registered", label: "Registered" }, { key: "enrolled", label: "Enrolled at university" }]} />}
          {tab === "funnel" && <BarChartView horizontal data={rows} xKey="stage" series={[{ key: "students", label: "Students reached" }]} />}
          {tab === "visa" && (() => {
            const v = report.extra as { approved: number; rejected: number; by_program: Record<string, unknown>[] };
            const total = Number(v.approved) + Number(v.rejected);
            return (
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">Success rate <b className="text-2xl text-foreground">{total ? Math.round((100 * v.approved) / total) : 0}%</b> · {v.approved} approved, {v.rejected} rejected</p>
                  <DonutChartView data={[{ name: "Approved", value: Number(v.approved) }, { name: "Rejected", value: Number(v.rejected) }]} />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">By program</p>
                  <BarChartView horizontal data={v.by_program.map(num).slice(0, 10)} xKey="name" series={[{ key: "approved", label: "Approved" }, { key: "rejected", label: "Rejected" }]} stacked />
                </div>
              </div>
            );
          })()}
          {tab === "counselors" && <BarChartView data={rows} xKey="counselor" series={[{ key: "students_handled", label: "Students handled" }, { key: "conversions", label: "Conversions" }, { key: "tasks_completed", label: "Tasks completed" }]} />}
          {tab === "sources" && <BarChartView data={rows} xKey="lead_source" series={[{ key: "students", label: "Students" }, { key: "conversions", label: "Conversions" }]} />}
          {tab === "offers" && (() => {
            const o = report.extra as Record<string, { name: string; count: number }[]>;
            return (
              <div className="grid gap-6 lg:grid-cols-2">
                <div><p className="mb-2 text-sm font-medium">By university</p><BarChartView horizontal data={o.by_university.map(num).slice(0, 15)} xKey="name" series={[{ key: "count", label: "Offers" }]} /></div>
                <div className="space-y-6">
                  <div><p className="mb-2 text-sm font-medium">By scholarship type</p><DonutChartView data={o.by_scholarship.map((r) => ({ name: r.name, value: Number(r.count) }))} height={200} /></div>
                  <div><p className="mb-2 text-sm font-medium">By intake</p><BarChartView data={o.by_intake.map(num)} xKey="name" series={[{ key: "count", label: "Offers" }]} height={200} /></div>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
      <ReportTable caption={`${REPORTS[tab]} data`} columns={report.columns} rows={rows} exportHref={exportHref} />
    </>
  );
}
