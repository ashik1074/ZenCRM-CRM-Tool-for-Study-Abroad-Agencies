import "server-only";
import { createClient } from "@/lib/supabase/server";
import { labelOf, STUDENT_STATUSES } from "@/lib/constants";

export const REPORTS = {
  university: "Universities",
  enrollment: "Enrollment trend",
  funnel: "Pipeline funnel",
  visa: "Visa outcomes",
  counselors: "Counselor performance",
  sources: "Lead sources",
  offers: "Offers",
} as const;
export type ReportName = keyof typeof REPORTS;

export type ReportTable = { columns: { key: string; label: string; numeric?: boolean }[]; rows: Record<string, string | number | null>[] };

/** Loads a report as table rows (charts are derived from the same rows). Runs under RLS + permission checks in SQL. */
export async function loadReport(name: ReportName, from: string, to: string, grain: "month" | "year" = "month"): Promise<ReportTable & { extra?: unknown }> {
  const supabase = createClient();
  const args = { p_from: from, p_to: to };
  switch (name) {
    case "university": {
      const { data, error } = await supabase.rpc("report_university", args);
      if (error) throw error;
      return {
        columns: [
          { key: "university", label: "University" }, { key: "city", label: "City" }, { key: "applications", label: "Applications", numeric: true },
          { key: "accepted", label: "Acceptances", numeric: true }, { key: "rejected", label: "Rejections", numeric: true }, { key: "enrolled", label: "Enrolled", numeric: true },
        ],
        rows: (data ?? []) as Record<string, number | string>[],
      };
    }
    case "enrollment": {
      const { data, error } = await supabase.rpc("report_enrollment_trend", { ...args, p_grain: grain });
      if (error) throw error;
      return { columns: [{ key: "period", label: grain === "year" ? "Year" : "Month" }, { key: "registered", label: "Registered", numeric: true }, { key: "enrolled", label: "Enrolled at university", numeric: true }], rows: (data ?? []) as Record<string, number | string>[] };
    }
    case "funnel": {
      const { data, error } = await supabase.rpc("report_funnel", args);
      if (error) throw error;
      const rows = (data ?? []) as { stage: string; stage_order: number; students: number }[];
      const first = Number(rows[0]?.students ?? 0);
      return {
        columns: [{ key: "stage", label: "Stage" }, { key: "students", label: "Students reached", numeric: true }, { key: "from_previous", label: "% of previous stage", numeric: true }, { key: "from_start", label: "% of inquiries", numeric: true }],
        rows: rows.map((r, i) => ({
          stage: labelOf(STUDENT_STATUSES, r.stage),
          students: Number(r.students),
          from_previous: i === 0 ? 100 : Number(rows[i - 1].students) ? Math.round((1000 * Number(r.students)) / Number(rows[i - 1].students)) / 10 : 0,
          from_start: first ? Math.round((1000 * Number(r.students)) / first) / 10 : 0,
        })),
      };
    }
    case "visa": {
      const { data, error } = await supabase.rpc("report_visa", args);
      if (error) throw error;
      const v = data as { approved: number; rejected: number; by_university: Record<string, number | string>[]; by_program: Record<string, number | string>[] };
      return {
        columns: [{ key: "name", label: "University" }, { key: "approved", label: "Approved", numeric: true }, { key: "rejected", label: "Rejected", numeric: true }, { key: "total", label: "Total", numeric: true }, { key: "success_rate", label: "Success rate %", numeric: true }],
        rows: v.by_university,
        extra: v,
      };
    }
    case "counselors": {
      const { data, error } = await supabase.rpc("report_counselors", args);
      if (error) throw error;
      return {
        columns: [{ key: "counselor", label: "Counselor" }, { key: "students_handled", label: "Students handled", numeric: true }, { key: "conversions", label: "Conversions (visa approved+)", numeric: true }, { key: "tasks_completed", label: "Tasks completed", numeric: true }],
        rows: (data ?? []) as Record<string, number | string>[],
      };
    }
    case "sources": {
      const { data, error } = await supabase.rpc("report_lead_sources", args);
      if (error) throw error;
      return {
        columns: [{ key: "lead_source", label: "Lead source" }, { key: "students", label: "Students", numeric: true }, { key: "conversions", label: "Conversions", numeric: true }, { key: "conversion_rate", label: "Conversion rate %", numeric: true }],
        rows: (data ?? []) as Record<string, number | string>[],
      };
    }
    case "offers": {
      const { data, error } = await supabase.rpc("report_offers", args);
      if (error) throw error;
      const o = data as Record<"by_university" | "by_scholarship" | "by_intake" | "by_status", { name: string; count: number }[]>;
      const rows: Record<string, string | number>[] = [
        ...o.by_university.map((r) => ({ dimension: "University", name: r.name, count: r.count })),
        ...o.by_scholarship.map((r) => ({ dimension: "Scholarship type", name: r.name, count: r.count })),
        ...o.by_intake.map((r) => ({ dimension: "Intake", name: r.name, count: r.count })),
      ];
      return { columns: [{ key: "dimension", label: "Grouped by" }, { key: "name", label: "Value" }, { key: "count", label: "Offers", numeric: true }], rows, extra: o };
    }
  }
}
