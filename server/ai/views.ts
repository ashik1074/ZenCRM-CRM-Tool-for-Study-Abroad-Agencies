import "server-only";
import { can } from "@/lib/permissions";
import type { CurrentUser } from "@/server/auth";

type ViewDoc = { name: string; description: string; columns: Record<string, string> };

const STATUS_NOTE =
  "Pipeline status values: inquiry, registered, documents_collecting, applied, offer_received, jw202_received, visa_applied, visa_approved, visa_rejected, departed, enrolled, dropped, on_hold.";

export const VIEW_DOCS: Record<string, ViewDoc> = {
  v_students: {
    name: "v_students",
    description: `One row per (non-deleted) student. ${STATUS_NOTE} 'Registered this year' = registered_date in the current year (the student record creation date).`,
    columns: {
      id: "uuid", student_code: "e.g. ST-1001", full_name: "text", gender: "male|female|other", date_of_birth: "date", nationality: "text",
      phone: "text", whatsapp: "text", email: "text", passport_no: "text", passport_issue_date: "date", passport_expiry_date: "date",
      status: "current pipeline status", intake: "e.g. 'September 2026'", intended_program_level: "Language|Diploma|Bachelor|Master|PhD",
      scholarship_type: "CSC|Provincial|University|Self-funded", hsk_level: "text", ielts_score: "numeric", lead_source: "Facebook|Referral|Walk-in|Website|Agent|…",
      referred_by: "text", counselor_name: "assigned counselor", previous_china_visa: "boolean", previous_china_residence: "boolean",
      registered_date: "date the student was added (Asia/Dhaka)", is_draft: "boolean, enrollment form not finished",
    },
  },
  v_student_status_history: {
    name: "v_student_status_history",
    description: "Every pipeline status change. Use to count events in a period, e.g. visa rejections in 2026: to_status='visa_rejected' and changed_date in 2026 (count distinct student_id).",
    columns: { student_id: "uuid", student_name: "text", from_status: "previous status (null for the first row)", to_status: "new status", changed_at_dhaka: "timestamp (Asia/Dhaka)", changed_date: "date (Asia/Dhaka)" },
  },
  v_applications: {
    name: "v_applications",
    description: "Student applications to university offers. Acceptances = status 'accepted'.",
    columns: {
      id: "uuid", student_id: "uuid", student_name: "text", student_status: "student's current pipeline status", university_name: "text", university_city: "text",
      offer_title: "text", program: "text", degree_level: "text", intake: "text", scholarship_type: "text",
      status: "submitted|under_review|accepted|rejected|withdrawn", applied_at: "date", decision_at: "date",
    },
  },
  v_offers: {
    name: "v_offers",
    description: "University offers (programs/scholarships).",
    columns: {
      id: "uuid", title: "text", university_name: "text", university_city: "text", program: "text", degree_level: "text", intake: "text",
      scholarship_type: "text", covers_tuition: "boolean", covers_accommodation: "boolean", stipend_amount: "numeric", stipend_currency: "text",
      tuition_fee: "numeric per year", accommodation_fee: "numeric per year", fee_currency: "BDT|CNY|USD", application_deadline: "date",
      language_of_instruction: "English|Chinese|Bilingual", source: "direct|partner_agent", status: "open|closed|expired", created_date: "date",
    },
  },
  v_universities: {
    name: "v_universities",
    description: "Partner universities in China.",
    columns: { id: "uuid", name: "text", city: "text", province: "text", ranking: "int", website: "text", is_active: "boolean" },
  },
  v_tasks: {
    name: "v_tasks",
    description: "Team tasks. status: todo|in_progress|in_review|done|paused|rejected; priority: low|medium|high|urgent.",
    columns: {
      id: "uuid", title: "text", status: "text", priority: "text", due_date: "date", tags: "text[]", assignee_name: "text", reporter_name: "text",
      sprint_name: "text", sprint_status: "planned|active|completed", student_name: "linked student", created_date: "date", completed_date: "date",
    },
  },
  v_finance: {
    name: "v_finance",
    description: "Income and expense transactions. ALWAYS sum amount_bdt for totals (amount is in the original currency). Profit = sum(income) - sum(expense).",
    columns: {
      id: "uuid", type: "income|expense", txn_date: "date", amount: "original amount", currency: "BDT|CNY|USD", exchange_rate: "to BDT",
      amount_bdt: "amount converted to BDT", category: "text", payment_method: "Cash|bKash|Nagad|Bank Transfer|Card", reference_no: "text",
      vendor: "expense payee", student_name: "paying student (income)", receipt_no: "text",
    },
  },
  v_fee_dues: {
    name: "v_fee_dues",
    description: "Per student fee plan: total package, paid, balance due and overdue amount (in the plan currency).",
    columns: { student_id: "uuid", student_name: "text", plan_title: "text", currency: "text", total_amount: "numeric", paid_amount: "numeric", balance_due: "numeric", overdue_amount: "numeric" },
  },
  v_my_student: { name: "v_my_student", description: "The signed-in student's own profile (same columns as a student record).", columns: { full_name: "text", status: "pipeline status", passport_expiry_date: "date", intake: "text", counselor_name: "text" } },
  v_my_status_history: { name: "v_my_status_history", description: "The signed-in student's own status changes.", columns: { from_status: "text", to_status: "text", changed_date: "date" } },
  v_my_applications: { name: "v_my_applications", description: "The signed-in student's own applications.", columns: { university_name: "text", offer_title: "text", program: "text", status: "text", applied_at: "date", decision_at: "date" } },
  v_my_payments: { name: "v_my_payments", description: "The signed-in student's own payments.", columns: { txn_date: "date", amount: "numeric", currency: "text", amount_bdt: "numeric", category: "text", payment_method: "text", receipt_no: "text" } },
};

/** Views this user may query. Enforced server-side when validating SQL — not just in the prompt. */
export function allowedViews(user: CurrentUser): string[] {
  if (user.portal === "student") return ["v_my_student", "v_my_status_history", "v_my_applications", "v_my_payments"];
  const p = user.permissions;
  const v: string[] = [];
  if (can(p, "students", "view")) v.push("v_students", "v_student_status_history");
  if (can(p, "applications", "view") || can(p, "students", "view")) v.push("v_applications");
  if (can(p, "offers", "view") || can(p, "universities", "view")) v.push("v_offers", "v_universities");
  if (can(p, "tasks_all", "view")) v.push("v_tasks");
  if (can(p, "assistant_finance", "view") && (can(p, "finance", "view") || can(p, "finance_reports", "view"))) v.push("v_finance", "v_fee_dues");
  return Array.from(new Set(v));
}

export function canUseKb(user: CurrentUser) {
  return can(user.permissions, "kb", "view") || can(user.permissions, "portal", "view");
}

export function schemaDoc(views: string[]): string {
  return views
    .map((n) => {
      const d = VIEW_DOCS[n];
      return `### ${n}\n${d.description}\nColumns:\n${Object.entries(d.columns).map(([c, t]) => `- ${c}: ${t}`).join("\n")}`;
    })
    .join("\n\n");
}
