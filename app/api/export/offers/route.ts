import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { exportResponse } from "@/lib/export";

const COLUMNS = [
  "title", "university", "city", "program", "degree_level", "intake", "scholarship_type", "covers_tuition", "covers_accommodation",
  "stipend_amount", "stipend_currency", "tuition_fee", "accommodation_fee", "fee_currency", "application_deadline",
  "language_of_instruction", "eligibility", "source", "partner_name", "status", "created_at",
];

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user.permissions, "offers", "export")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = req.nextUrl.searchParams;
  let q = createClient().from("offers").select("*, u:universities!inner(name, city)").is("deleted_at", null);
  if (p.get("university")) q = q.eq("university_id", p.get("university")!);
  if (p.get("city")) q = q.eq("u.city", p.get("city")!);
  if (p.get("degree")) q = q.eq("degree_level", p.get("degree")!);
  if (p.get("intake")) q = q.eq("intake", p.get("intake")!);
  if (p.get("scholarship")) q = q.eq("scholarship_type", p.get("scholarship")!);
  const status = p.get("status") ?? "open";
  if (status !== "all") q = q.eq("status", status);
  if (p.get("from")) q = q.gte("application_deadline", p.get("from")!);
  if (p.get("to")) q = q.lte("application_deadline", p.get("to")!);
  const { data, error } = await q.order("application_deadline").limit(10000);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const u = r.u as { name: string; city: string | null };
    return { ...r, university: u.name, city: u.city };
  });
  return exportResponse(rows, COLUMNS, "offers", p.get("format") === "csv" ? "csv" : "xlsx");
}
