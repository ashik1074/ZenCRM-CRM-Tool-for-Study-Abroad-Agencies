import { z } from "zod";
import { DEGREE_LEVELS, EDUCATION_LEVELS, SCHOLARSHIP_TYPES, STUDENT_STATUSES } from "@/lib/constants";
import { optDate, optNum, optStr, optUuid, reqStr, str } from "./common";

const personDob = z.object({ id: optStr(40), name: optStr(120), date_of_birth: optDate });

export const educationSchema = z.object({
  id: optStr(40),
  level: z.enum(EDUCATION_LEVELS, { message: "Choose a level" }),
  institution: reqStr("Institution", 200),
  degree: optStr(120),
  major: optStr(120),
  passing_year: optNum.refine((v) => v === "" || (Number(v) >= 1950 && Number(v) <= 2100), "Enter a valid year"),
  gpa: optStr(20),
});

export const workSchema = z.object({
  id: optStr(40),
  company: reqStr("Company", 200),
  address: optStr(300),
  employer_phone: optStr(40),
  position: optStr(120),
  duty: optStr(500),
  supervisor_name: optStr(120),
  supervisor_phone: optStr(40),
  start_date: optDate,
  end_date: optDate,
});

export const travelSchema = z.object({
  id: optStr(40),
  country: reqStr("Country", 80),
  visa_type: optStr(80),
  valid_until: optDate,
  visited_from: optDate,
  visited_to: optDate,
});

export const studentSchema = z.object({
  id: optUuid,
  // 1. personal
  full_name: reqStr("Full name", 150),
  photo_path: optStr(500),
  gender: z.enum(["", "male", "female", "other"]).default(""),
  date_of_birth: optDate,
  nationality: optStr(60),
  phone: optStr(30),
  whatsapp: optStr(30),
  email: z.string().trim().max(200).optional().default("").refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email"),
  present_address: optStr(500),
  permanent_address: optStr(500),
  // 2. passport
  passport_no: optStr(30),
  passport_issue_date: optDate,
  passport_expiry_date: optDate,
  // 3. family
  father: personDob,
  mother: personDob,
  spouse: personDob,
  children: z.array(personDob).default([]),
  // 4–5
  education: z.array(educationSchema).default([]),
  work: z.array(workSchema).default([]),
  // 6. language
  hsk_level: optStr(20),
  ielts_score: optNum.refine((v) => v === "" || (Number(v) >= 0 && Number(v) <= 9), "IELTS score is 0–9"),
  other_language_scores: optStr(300),
  // 7. preferences
  intended_program_level: z.enum(["", ...DEGREE_LEVELS]).default(""),
  preferred_majors: optStr(500),
  preferred_cities: optStr(500),
  preferred_universities: optStr(500),
  intake: optStr(40),
  scholarship_type: z.enum(["", ...SCHOLARSHIP_TYPES]).default(""),
  // 8. travel
  has_valid_foreign_visa: z.boolean().default(false),
  valid_visas: z.array(travelSchema).default([]),
  visited_countries_past_12m: z.boolean().default(false),
  visits: z.array(travelSchema).default([]),
  previous_china_visa: z.boolean().default(false),
  previous_china_residence: z.boolean().default(false),
  // 9. source
  lead_source: optStr(60),
  referred_by: optStr(120),
  counselor_id: optUuid,
  status: z.enum(STUDENT_STATUSES.map((s) => s.value) as [string, ...string[]]).default("inquiry"),
  notes: optStr(2000),
});

export type StudentFormInput = z.input<typeof studentSchema>;
export type StudentFormValues = z.output<typeof studentSchema>;

/** Extra requirements when finalising (not a draft). */
export const studentFinalSchema = studentSchema.superRefine((v, ctx) => {
  if (!v.phone) ctx.addIssue({ code: "custom", path: ["phone"], message: "Phone is required" });
  if (!v.gender) ctx.addIssue({ code: "custom", path: ["gender"], message: "Choose a gender" });
  if (!v.date_of_birth) ctx.addIssue({ code: "custom", path: ["date_of_birth"], message: "Date of birth is required" });
  if (v.passport_issue_date && v.passport_expiry_date && v.passport_expiry_date <= v.passport_issue_date)
    ctx.addIssue({ code: "custom", path: ["passport_expiry_date"], message: "Expiry must be after issue date" });
  v.work.forEach((w, i) => {
    if (w.start_date && w.end_date && w.end_date < w.start_date)
      ctx.addIssue({ code: "custom", path: ["work", i, "end_date"], message: "End date is before start date" });
  });
});

/** Which fields live on which step (used to validate a step before moving on and to jump to errors). */
export const STEP_FIELDS: Record<number, string[]> = {
  0: ["full_name", "gender", "date_of_birth", "nationality", "phone", "whatsapp", "email", "present_address", "permanent_address"],
  1: ["passport_no", "passport_issue_date", "passport_expiry_date"],
  2: ["father", "mother", "spouse", "children"],
  3: ["education"],
  4: ["work"],
  5: ["hsk_level", "ielts_score", "other_language_scores"],
  6: ["intended_program_level", "preferred_majors", "preferred_cities", "preferred_universities", "intake", "scholarship_type"],
  7: ["has_valid_foreign_visa", "valid_visas", "visited_countries_past_12m", "visits", "previous_china_visa", "previous_china_residence"],
  8: ["lead_source", "referred_by", "counselor_id", "status", "notes"],
};

export const statusChangeSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STUDENT_STATUSES.map((s) => s.value) as [string, ...string[]]),
  note: str(500).optional(),
});

export const documentSchema = z.object({
  student_id: z.string().uuid(),
  category: reqStr("Category", 60),
  file_path: reqStr("File", 500),
  file_name: reqStr("File name", 255),
  mime_type: optStr(120),
  size_bytes: z.number().int().nonnegative().max(10 * 1024 * 1024, "Files must be 10 MB or smaller"),
  expiry_date: optDate,
});
