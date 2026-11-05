import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { can } from "@/lib/permissions";
import { transactionsQuery } from "@/server/queries/finance";
import { exportResponse } from "@/lib/export";

const COLUMNS = ["txn_date", "type", "category", "amount", "currency", "exchange_rate", "amount_bdt", "student", "vendor", "payment_method", "reference_no", "receipt_no", "note", "created_at"];

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user.permissions, "finance", "export")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { data, error } = await transactionsQuery(params, "*, c:transaction_categories(name), s:students(full_name)").limit(20000);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    ...r,
    category: (r.c as { name: string } | null)?.name ?? "",
    student: (r.s as { full_name: string } | null)?.full_name ?? "",
  }));
  return exportResponse(rows, COLUMNS, "transactions", params.format === "csv" ? "csv" : "xlsx");
}
