import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { can } from "@/lib/permissions";
import { studentsQuery } from "@/server/queries/students";
import { exportResponse } from "@/lib/export";

const COLUMNS = [
  "student_code", "full_name", "gender", "date_of_birth", "nationality", "phone", "whatsapp", "email", "present_address",
  "permanent_address", "passport_no", "passport_issue_date", "passport_expiry_date", "hsk_level", "ielts_score",
  "other_language_scores", "intended_program_level", "preferred_majors", "preferred_cities", "preferred_universities",
  "intake", "scholarship_type", "has_valid_foreign_visa", "visited_countries_past_12m", "previous_china_visa",
  "previous_china_residence", "lead_source", "referred_by", "counselor", "status", "is_draft", "created_at", "updated_at",
];

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user.permissions, "students", "export")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const format = params.format === "csv" ? "csv" : "xlsx";
  const { data, error } = await studentsQuery(params, `*, counselor_rel:profiles!students_counselor_id_fkey(full_name)`, { meId: user.id }).limit(10000);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    ...r,
    counselor: (r.counselor_rel as { full_name: string } | null)?.full_name ?? "",
  }));
  return exportResponse(rows, COLUMNS, "students", format);
}
