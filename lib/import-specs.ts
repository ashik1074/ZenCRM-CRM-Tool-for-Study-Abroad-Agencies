import { z } from "zod";
import { DEGREE_LEVELS, LANGUAGES_OF_INSTRUCTION, SCHOLARSHIP_TYPES, STUDENT_STATUSES } from "./constants";

/** Field definitions shared by the import UI (mapping + preview) and the server (re-validation). */
export type ImportField = { key: string; label: string; required?: boolean; aliases: string[] };

const date = z.string().trim().optional().default("").refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use YYYY-MM-DD");
const opt = (max = 200) => z.string().trim().max(max).optional().default("");
const oneOf = (vals: readonly string[], label: string) =>
  z.string().trim().optional().default("").refine((v) => !v || vals.some((x) => x.toLowerCase() === v.toLowerCase()), `${label} must be one of: ${vals.join(", ")}`);
const num = z.string().trim().optional().default("").refine((v) => !v || !Number.isNaN(Number(v.replace(/,/g, ""))), "Must be a number");

export const STUDENT_IMPORT: { fields: ImportField[]; schema: z.ZodObject<z.ZodRawShape> } = {
  fields: [
    { key: "full_name", label: "Full name", required: true, aliases: ["name", "student name", "full name"] },
    { key: "phone", label: "Phone", aliases: ["mobile", "phone number", "contact"] },
    { key: "whatsapp", label: "WhatsApp", aliases: ["whatsapp number"] },
    { key: "email", label: "Email", aliases: ["e-mail", "gmail", "email address"] },
    { key: "gender", label: "Gender", aliases: ["sex"] },
    { key: "date_of_birth", label: "Date of birth", aliases: ["dob", "birth date", "birthday"] },
    { key: "passport_no", label: "Passport number", aliases: ["passport", "passport no"] },
    { key: "passport_issue_date", label: "Passport issue date", aliases: ["issue date"] },
    { key: "passport_expiry_date", label: "Passport expiry date", aliases: ["expiry date", "passport expiry"] },
    { key: "intake", label: "Intake", aliases: [] },
    { key: "intended_program_level", label: "Program level", aliases: ["level", "degree", "program level"] },
    { key: "scholarship_type", label: "Scholarship type", aliases: ["scholarship"] },
    { key: "lead_source", label: "Lead source", aliases: ["source"] },
    { key: "status", label: "Status", aliases: ["pipeline status"] },
    { key: "counselor_email", label: "Counselor email", aliases: ["counselor", "counsellor"] },
  ],
  schema: z.object({
    full_name: z.string().trim().min(1, "Full name is required").max(150),
    phone: opt(30), whatsapp: opt(30),
    email: z.string().trim().optional().default("").refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid email"),
    gender: oneOf(["male", "female", "other"], "Gender"),
    date_of_birth: date, passport_no: opt(30), passport_issue_date: date, passport_expiry_date: date,
    intake: opt(40), intended_program_level: oneOf(DEGREE_LEVELS, "Program level"), scholarship_type: oneOf(SCHOLARSHIP_TYPES, "Scholarship type"),
    lead_source: opt(60), status: oneOf(STUDENT_STATUSES.map((s) => s.value), "Status"), counselor_email: opt(120),
  }),
};

export const OFFER_IMPORT: { fields: ImportField[]; schema: z.ZodObject<z.ZodRawShape> } = {
  fields: [
    { key: "title", label: "Offer title", required: true, aliases: ["offer", "name", "offer name"] },
    { key: "university", label: "University", required: true, aliases: ["university name", "school"] },
    { key: "program", label: "Program / major", required: true, aliases: ["major", "programme", "course"] },
    { key: "degree_level", label: "Degree level", required: true, aliases: ["degree", "level"] },
    { key: "intake", label: "Intake", aliases: [] },
    { key: "scholarship_type", label: "Scholarship type", aliases: ["scholarship"] },
    { key: "tuition_fee", label: "Tuition fee", aliases: ["tuition"] },
    { key: "accommodation_fee", label: "Accommodation fee", aliases: ["accommodation", "dorm fee"] },
    { key: "fee_currency", label: "Fee currency", aliases: ["currency"] },
    { key: "stipend_amount", label: "Stipend", aliases: ["stipend amount"] },
    { key: "application_deadline", label: "Application deadline", aliases: ["deadline"] },
    { key: "language_of_instruction", label: "Language of instruction", aliases: ["language", "medium"] },
    { key: "eligibility", label: "Eligibility", aliases: ["requirements"] },
  ],
  schema: z.object({
    title: z.string().trim().min(1, "Title is required").max(200),
    university: z.string().trim().min(1, "University is required").max(200),
    program: z.string().trim().min(1, "Program is required").max(200),
    degree_level: z.string().trim().refine((v) => DEGREE_LEVELS.some((d) => d.toLowerCase() === v.toLowerCase()), `Degree level must be one of: ${DEGREE_LEVELS.join(", ")}`),
    intake: opt(40), scholarship_type: oneOf(SCHOLARSHIP_TYPES, "Scholarship type"),
    tuition_fee: num, accommodation_fee: num, fee_currency: oneOf(["BDT", "CNY", "USD"], "Currency"), stipend_amount: num,
    application_deadline: date, language_of_instruction: oneOf(LANGUAGES_OF_INSTRUCTION, "Language"), eligibility: opt(3000),
  }),
};

/** Canonical casing for enum-like values (e.g. "csc" -> "CSC"). */
export function canon(value: string, options: readonly string[]) {
  return options.find((o) => o.toLowerCase() === value.trim().toLowerCase()) ?? value.trim();
}

export function autoMap(headers: string[], fields: ImportField[]): Record<string, string> {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const map: Record<string, string> = {};
  for (const f of fields) {
    const candidates = [f.key.replace(/_/g, " "), f.label, ...f.aliases].map(norm);
    const h = headers.find((h) => candidates.includes(norm(h)));
    if (h) map[f.key] = h;
  }
  return map;
}
