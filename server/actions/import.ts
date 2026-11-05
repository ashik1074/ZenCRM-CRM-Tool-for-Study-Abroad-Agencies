"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/server/auth";
import { must, run, type ActionResult } from "@/server/action";
import { canon, OFFER_IMPORT, STUDENT_IMPORT } from "@/lib/import-specs";
import { DEGREE_LEVELS, LANGUAGES_OF_INSTRUCTION, SCHOLARSHIP_TYPES } from "@/lib/constants";

export type ImportResult = { imported: number; skipped: { row: number; reason: string }[]; created_universities: string[] };
const nul = (v: unknown) => (v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim());
const numOrNull = (v: unknown) => (nul(v) === null ? null : Number(String(v).replace(/,/g, "")));

/** Duplicate check for the preview: returns row indexes whose phone/email/passport already exist. */
export async function checkStudentDuplicates(rows: { phone?: string; email?: string; passport_no?: string }[]): Promise<Record<number, string>> {
  await assertPermission("students", "view");
  const supabase = createClient();
  const phones = rows.map((r) => r.phone?.trim()).filter(Boolean) as string[];
  const emails = rows.map((r) => r.email?.trim().toLowerCase()).filter(Boolean) as string[];
  const passports = rows.map((r) => r.passport_no?.trim().toUpperCase()).filter(Boolean) as string[];
  const found = { phone: new Set<string>(), email: new Set<string>(), passport: new Set<string>() };
  const chunks = <T,>(a: T[]) => Array.from({ length: Math.ceil(a.length / 200) }, (_, i) => a.slice(i * 200, i * 200 + 200));
  for (const c of chunks(phones)) (await supabase.from("students").select("phone").in("phone", c).is("deleted_at", null)).data?.forEach((r: { phone: string }) => found.phone.add(r.phone));
  for (const c of chunks(emails)) (await supabase.from("students").select("email").in("email", c).is("deleted_at", null)).data?.forEach((r: { email: string }) => found.email.add(r.email.toLowerCase()));
  for (const c of chunks(passports)) (await supabase.from("students").select("passport_no").in("passport_no", c).is("deleted_at", null)).data?.forEach((r: { passport_no: string }) => found.passport.add(r.passport_no.toUpperCase()));
  const out: Record<number, string> = {};
  rows.forEach((r, i) => {
    const m = [
      r.phone && found.phone.has(r.phone.trim()) && "phone",
      r.email && found.email.has(r.email.trim().toLowerCase()) && "email",
      r.passport_no && found.passport.has(r.passport_no.trim().toUpperCase()) && "passport",
    ].filter(Boolean);
    if (m.length) out[i] = `Existing student with same ${m.join(", ")}`;
  });
  return out;
}

export async function importStudents(rows: Record<string, string>[], opts: { skipDuplicates: boolean }): Promise<ActionResult<ImportResult>> {
  return run(async () => {
    await assertPermission("import", "create");
    await assertPermission("students", "create");
    if (rows.length > 2000) throw new Error("Import at most 2,000 rows at a time.");
    const supabase = createClient();
    const { data: staff } = await supabase.from("profiles").select("id, email");
    const byEmail = new Map((staff ?? []).map((s: { id: string; email: string }) => [s.email.toLowerCase(), s.id]));
    const dups = opts.skipDuplicates ? await checkStudentDuplicates(rows) : {};
    const skipped: ImportResult["skipped"] = [];
    const valid: Record<string, unknown>[] = [];
    rows.forEach((raw, i) => {
      if (dups[i]) return skipped.push({ row: i + 2, reason: dups[i] });
      const p = STUDENT_IMPORT.schema.safeParse(raw);
      if (!p.success) return skipped.push({ row: i + 2, reason: p.error.issues[0].message });
      const v = p.data as Record<string, string>;
      valid.push({
        full_name: v.full_name, phone: nul(v.phone), whatsapp: nul(v.whatsapp), email: nul(v.email)?.toLowerCase() ?? null,
        gender: nul(v.gender)?.toLowerCase() ?? null, date_of_birth: nul(v.date_of_birth), passport_no: nul(v.passport_no)?.toUpperCase() ?? null,
        passport_issue_date: nul(v.passport_issue_date), passport_expiry_date: nul(v.passport_expiry_date), intake: nul(v.intake),
        intended_program_level: v.intended_program_level ? canon(v.intended_program_level, DEGREE_LEVELS) : null,
        scholarship_type: v.scholarship_type ? canon(v.scholarship_type, SCHOLARSHIP_TYPES) : null,
        lead_source: nul(v.lead_source), status: nul(v.status)?.toLowerCase() ?? "inquiry",
        counselor_id: v.counselor_email ? byEmail.get(v.counselor_email.toLowerCase()) ?? null : null,
      });
    });
    for (let i = 0; i < valid.length; i += 200) must(await supabase.from("students").insert(valid.slice(i, i + 200)));
    revalidatePath("/students");
    return { imported: valid.length, skipped, created_universities: [] };
  }, "Import finished");
}

export async function importOffers(rows: Record<string, string>[]): Promise<ActionResult<ImportResult>> {
  return run(async () => {
    await assertPermission("import", "create");
    await assertPermission("offers", "create");
    if (rows.length > 2000) throw new Error("Import at most 2,000 rows at a time.");
    const supabase = createClient();
    const { data: unis } = await supabase.from("universities").select("id, name").is("deleted_at", null);
    const uniMap = new Map((unis ?? []).map((u: { id: string; name: string }) => [u.name.toLowerCase(), u.id]));
    const created: string[] = [];
    const skipped: ImportResult["skipped"] = [];
    const valid: Record<string, unknown>[] = [];
    for (const [i, raw] of rows.entries()) {
      const p = OFFER_IMPORT.schema.safeParse(raw);
      if (!p.success) { skipped.push({ row: i + 2, reason: p.error.issues[0].message }); continue; }
      const v = p.data as Record<string, string>;
      let uniId = uniMap.get(v.university.toLowerCase());
      if (!uniId) {
        await assertPermission("universities", "create");
        const u = must(await supabase.from("universities").insert({ name: v.university }).select("id").single()) as { id: string };
        uniId = u.id;
        uniMap.set(v.university.toLowerCase(), uniId);
        created.push(v.university);
      }
      valid.push({
        title: v.title, university_id: uniId, program: v.program, degree_level: canon(v.degree_level, DEGREE_LEVELS), intake: nul(v.intake),
        scholarship_type: v.scholarship_type ? canon(v.scholarship_type, SCHOLARSHIP_TYPES) : null,
        covers_tuition: ["CSC", "Provincial"].includes(canon(v.scholarship_type ?? "", SCHOLARSHIP_TYPES)), covers_accommodation: canon(v.scholarship_type ?? "", SCHOLARSHIP_TYPES) === "CSC",
        tuition_fee: numOrNull(v.tuition_fee), accommodation_fee: numOrNull(v.accommodation_fee), stipend_amount: numOrNull(v.stipend_amount),
        fee_currency: v.fee_currency ? v.fee_currency.toUpperCase() : "CNY", application_deadline: nul(v.application_deadline),
        language_of_instruction: v.language_of_instruction ? canon(v.language_of_instruction, LANGUAGES_OF_INSTRUCTION) : null, eligibility: nul(v.eligibility),
      });
    }
    for (let i = 0; i < valid.length; i += 200) must(await supabase.from("offers").insert(valid.slice(i, i + 200)));
    revalidatePath("/offers");
    return { imported: valid.length, skipped, created_universities: created };
  }, "Import finished");
}
