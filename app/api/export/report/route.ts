import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { can } from "@/lib/permissions";
import { loadReport, REPORTS, type ReportName } from "@/server/queries/reports";
import { exportResponse } from "@/lib/export";

const date = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = req.nextUrl.searchParams;
  const name = p.get("name") as ReportName | "finance";
  const from = p.get("from") ?? "", to = p.get("to") ?? "";
  if (!date.test(from) || !date.test(to)) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  const format = p.get("format") === "csv" ? "csv" : "xlsx";

  if (name === "finance") {
    if (!can(user.permissions, "finance_reports", "export")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { loadFinanceReportRows } = await import("@/server/queries/finance-report");
    const t = await loadFinanceReportRows(from, to);
    return exportResponse(t.rows, t.columns.map((c) => c.key), `finance-${from}-to-${to}`, format);
  }
  if (!(name in REPORTS)) return NextResponse.json({ error: "Unknown report" }, { status: 400 });
  if (!can(user.permissions, "reports", "view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const t = await loadReport(name, from, to, p.get("grain") === "year" ? "year" : "month");
    return exportResponse(t.rows, t.columns.map((c) => c.key), `${name}-report`, format);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
