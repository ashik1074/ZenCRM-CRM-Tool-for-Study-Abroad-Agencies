export const TZ = "Asia/Dhaka";
export const CURRENCIES = ["BDT", "CNY", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const PAGE_SIZE = 20;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel",
];
export const ACCEPT_ATTR = ".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx";

type Opt<T extends string> = { value: T; label: string; tone: Tone };
export type Tone = "gray" | "blue" | "sky" | "indigo" | "violet" | "amber" | "orange" | "green" | "emerald" | "red" | "slate" | "teal";

export const STUDENT_STATUSES = [
  { value: "inquiry", label: "Inquiry", tone: "gray" },
  { value: "registered", label: "Registered", tone: "slate" },
  { value: "documents_collecting", label: "Documents Collecting", tone: "amber" },
  { value: "applied", label: "Applied", tone: "sky" },
  { value: "offer_received", label: "Offer Received", tone: "blue" },
  { value: "jw202_received", label: "JW202 Received", tone: "indigo" },
  { value: "visa_applied", label: "Visa Applied", tone: "violet" },
  { value: "visa_approved", label: "Visa Approved", tone: "green" },
  { value: "visa_rejected", label: "Visa Rejected", tone: "red" },
  { value: "departed", label: "Departed", tone: "teal" },
  { value: "enrolled", label: "Enrolled at University", tone: "emerald" },
  { value: "dropped", label: "Dropped", tone: "red" },
  { value: "on_hold", label: "On Hold", tone: "orange" },
] as const satisfies readonly Opt<string>[];
export type StudentStatus = (typeof STUDENT_STATUSES)[number]["value"];

export const TASK_STATUSES = [
  { value: "todo", label: "To Do", tone: "slate" },
  { value: "in_progress", label: "In Progress", tone: "blue" },
  { value: "in_review", label: "In Review", tone: "violet" },
  { value: "done", label: "Done", tone: "green" },
  { value: "paused", label: "Paused", tone: "amber" },
  { value: "rejected", label: "Rejected", tone: "red" },
] as const satisfies readonly Opt<string>[];
export type TaskStatus = (typeof TASK_STATUSES)[number]["value"];

export const TASK_PRIORITIES = [
  { value: "low", label: "Low", tone: "gray" },
  { value: "medium", label: "Medium", tone: "sky" },
  { value: "high", label: "High", tone: "orange" },
  { value: "urgent", label: "Urgent", tone: "red" },
] as const satisfies readonly Opt<string>[];
export type TaskPriority = (typeof TASK_PRIORITIES)[number]["value"];
export const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export const SPRINT_STATUSES = [
  { value: "planned", label: "Planned", tone: "slate" },
  { value: "active", label: "Active", tone: "green" },
  { value: "completed", label: "Completed", tone: "gray" },
] as const satisfies readonly Opt<string>[];

export const APPLICATION_STATUSES = [
  { value: "submitted", label: "Submitted", tone: "sky" },
  { value: "under_review", label: "Under Review", tone: "violet" },
  { value: "accepted", label: "Accepted", tone: "green" },
  { value: "rejected", label: "Rejected", tone: "red" },
  { value: "withdrawn", label: "Withdrawn", tone: "gray" },
] as const satisfies readonly Opt<string>[];

export const OFFER_STATUSES = [
  { value: "open", label: "Open", tone: "green" },
  { value: "closed", label: "Closed", tone: "gray" },
  { value: "expired", label: "Expired", tone: "red" },
] as const satisfies readonly Opt<string>[];

export const DEGREE_LEVELS = ["Language", "Diploma", "Bachelor", "Master", "PhD"] as const;
export const EDUCATION_LEVELS = ["SSC", "HSC", "Diploma", "Bachelor", "Master"] as const;
export const SCHOLARSHIP_TYPES = ["CSC", "Provincial", "University", "Self-funded"] as const;
export const LANGUAGES_OF_INSTRUCTION = ["English", "Chinese", "Bilingual"] as const;
export const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
] as const;
export const HSK_LEVELS = ["HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6"] as const;
export const PAYMENT_METHODS = ["Cash", "bKash", "Nagad", "Bank Transfer", "Card"] as const;
export const DEFAULT_DOC_CATEGORIES = ["Passport", "Photo", "Transcript", "Certificate", "Bank Statement", "Solvency", "Admission Letter", "JW202", "Visa", "Other"];
export const DEFAULT_LEAD_SOURCES = ["Facebook", "Referral", "Walk-in", "Website", "Agent"];

export function labelOf(list: readonly { value: string; label: string }[], v: string | null | undefined) {
  return list.find((x) => x.value === v)?.label ?? v ?? "—";
}
export function toneOf(list: readonly { value: string; tone: Tone }[], v: string | null | undefined): Tone {
  return list.find((x) => x.value === v)?.tone ?? "gray";
}
