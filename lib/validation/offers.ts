import { z } from "zod";
import { APPLICATION_STATUSES, CURRENCIES, DEGREE_LEVELS, LANGUAGES_OF_INSTRUCTION, SCHOLARSHIP_TYPES } from "@/lib/constants";
import { optDate, optNum, optStr, reqStr } from "./common";

export const universitySchema = z.object({
  id: optStr(40),
  name: reqStr("University name", 200),
  city: optStr(80),
  province: optStr(80),
  ranking: optNum,
  website: optStr(300).refine((v) => !v || /^https?:\/\//i.test(v), "Website must start with http:// or https://"),
  contact_person: optStr(120),
  email: optStr(200).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email"),
  phone: optStr(40),
  notes: optStr(2000),
  is_active: z.boolean().default(true),
});
export type UniversityInput = z.input<typeof universitySchema>;

const nonNeg = optNum.refine((v) => v === "" || Number(v) >= 0, "Must be 0 or more");

export const offerSchema = z.object({
  id: optStr(40),
  title: reqStr("Offer title", 200),
  university_id: z.string().uuid("Choose a university"),
  program: reqStr("Program / major", 200),
  degree_level: z.enum(DEGREE_LEVELS, { message: "Choose a degree level" }),
  intake: optStr(40),
  scholarship_type: z.enum(["", ...SCHOLARSHIP_TYPES]).default(""),
  covers_tuition: z.boolean().default(false),
  covers_accommodation: z.boolean().default(false),
  stipend_amount: nonNeg,
  stipend_currency: z.enum(CURRENCIES).default("CNY"),
  tuition_fee: nonNeg,
  accommodation_fee: nonNeg,
  fee_currency: z.enum(CURRENCIES).default("CNY"),
  application_deadline: optDate,
  language_of_instruction: z.enum(["", ...LANGUAGES_OF_INSTRUCTION]).default(""),
  eligibility: optStr(3000),
  source: z.enum(["direct", "partner_agent"]).default("direct"),
  partner_name: optStr(120),
  status: z.enum(["open", "closed", "expired"]).default("open"),
});
export type OfferInput = z.input<typeof offerSchema>;

export const applicationSchema = z.object({
  student_id: z.string().uuid(),
  offer_id: z.string().uuid("Choose an offer"),
  applied_at: optDate,
  notes: optStr(1000),
});

export const applicationStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(APPLICATION_STATUSES.map((s) => s.value) as [string, ...string[]]),
});
