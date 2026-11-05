"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission, getCurrentUser, ForbiddenError } from "@/server/auth";
import { must, run, type ActionResult } from "@/server/action";
import { csv, nul, numOrNull } from "@/lib/validation/common";
import { documentSchema, statusChangeSchema, studentFinalSchema, studentSchema, type StudentFormInput, type StudentFormValues } from "@/lib/validation/student";
import { ALLOWED_MIME } from "@/lib/constants";

type Supa = ReturnType<typeof createClient>;

function studentRow(v: StudentFormValues) {
  return {
    full_name: v.full_name.trim(),
    photo_path: nul(v.photo_path),
    gender: nul(v.gender),
    date_of_birth: nul(v.date_of_birth),
    nationality: nul(v.nationality) ?? "Bangladeshi",
    phone: nul(v.phone),
    whatsapp: nul(v.whatsapp),
    email: nul(v.email)?.toLowerCase() ?? null,
    present_address: nul(v.present_address),
    permanent_address: nul(v.permanent_address),
    passport_no: nul(v.passport_no)?.toUpperCase() ?? null,
    passport_issue_date: nul(v.passport_issue_date),
    passport_expiry_date: nul(v.passport_expiry_date),
    hsk_level: nul(v.hsk_level),
    ielts_score: numOrNull(v.ielts_score),
    other_language_scores: nul(v.other_language_scores),
    intended_program_level: nul(v.intended_program_level),
    preferred_majors: csv(v.preferred_majors),
    preferred_cities: csv(v.preferred_cities),
    preferred_universities: csv(v.preferred_universities),
    intake: nul(v.intake),
    scholarship_type: nul(v.scholarship_type),
    has_valid_foreign_visa: v.has_valid_foreign_visa,
    visited_countries_past_12m: v.visited_countries_past_12m,
    previous_china_visa: v.previous_china_visa,
    previous_china_residence: v.previous_china_residence,
    lead_source: nul(v.lead_source),
    referred_by: nul(v.referred_by),
    counselor_id: nul(v.counselor_id),
    notes: nul(v.notes),
  };
}

/**
 * Sync a child table to the submitted rows: update rows with ids, insert new ones, delete the rest.
 * Keeps the audit log precise (only real changes are logged).
 */
async function syncChildren(supabase: Supa, table: string, studentId: string, rows: Record<string, unknown>[], scope?: Record<string, string>) {
  let q = supabase.from(table).select("id").eq("student_id", studentId);
  if (scope) for (const [k, val] of Object.entries(scope)) q = q.eq(k, val);
  const existing = (must(await q) as { id: string }[]).map((r) => r.id);
  const keep = new Set(rows.map((r) => r.id).filter(Boolean) as string[]);
  const toDelete = existing.filter((id) => !keep.has(id));
  if (toDelete.length) must(await supabase.from(table).delete().in("id", toDelete));
  for (const r of rows) {
    const { id, ...data } = r;
    if (id && existing.includes(id as string)) must(await supabase.from(table).update(data).eq("id", id as string));
    else must(await supabase.from(table).insert({ ...data, student_id: studentId }));
  }
}

export async function saveStudent(
  input: StudentFormInput,
  opts: { draft: boolean },
): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const isNew = !input.id || !(await studentExists(input.id));
    await assertPermission("students", isNew ? "create" : "edit");
    const v = (opts.draft ? studentSchema : studentFinalSchema).parse(input);
    const supabase = createClient();
    const row = studentRow(v);
    let id = v.id || undefined;

    if (isNew) {
      const created = must(
        await supabase.from("students").insert({ ...row, id, status: v.status || "inquiry", is_draft: opts.draft }).select("id").single(),
      ) as { id: string };
      id = created.id;
    } else {
      must(await supabase.from("students").update({ ...row, status: v.status, is_draft: opts.draft }).eq("id", id!));
    }

    // family
    const fam: Record<string, unknown>[] = [];
    (["father", "mother", "spouse"] as const).forEach((rel, i) => {
      const p = v[rel];
      if (p.name?.trim()) fam.push({ id: nul(p.id), relation: rel, name: p.name.trim(), date_of_birth: nul(p.date_of_birth), sort_order: i });
    });
    v.children.filter((c) => c.name?.trim()).forEach((c, i) => fam.push({ id: nul(c.id), relation: "child", name: c.name.trim(), date_of_birth: nul(c.date_of_birth), sort_order: 10 + i }));
    await syncChildren(supabase, "student_family_members", id!, fam);

    await syncChildren(
      supabase,
      "student_education",
      id!,
      v.education.map((e, i) => ({
        id: nul(e.id), level: e.level, institution: e.institution, degree: nul(e.degree), major: nul(e.major),
        passing_year: numOrNull(e.passing_year), gpa: nul(e.gpa), sort_order: i,
      })),
    );
    await syncChildren(
      supabase,
      "student_work_experience",
      id!,
      v.work.map((w) => ({
        id: nul(w.id), company: w.company, address: nul(w.address), employer_phone: nul(w.employer_phone), position: nul(w.position),
        duty: nul(w.duty), supervisor_name: nul(w.supervisor_name), supervisor_phone: nul(w.supervisor_phone),
        start_date: nul(w.start_date), end_date: nul(w.end_date),
      })),
    );
    await syncChildren(
      supabase,
      "student_travel_history",
      id!,
      v.has_valid_foreign_visa ? v.valid_visas.map((t) => ({ id: nul(t.id), kind: "valid_visa", country: t.country, visa_type: nul(t.visa_type), valid_until: nul(t.valid_until) })) : [],
      { kind: "valid_visa" },
    );
    await syncChildren(
      supabase,
      "student_travel_history",
      id!,
      v.visited_countries_past_12m ? v.visits.map((t) => ({ id: nul(t.id), kind: "visit", country: t.country, visited_from: nul(t.visited_from), visited_to: nul(t.visited_to) })) : [],
      { kind: "visit" },
    );

    revalidatePath("/students");
    revalidatePath(`/students/${id}`);
    return { id: id! };
  }, opts.draft ? "Draft saved" : "Student saved");
}

async function studentExists(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const { data } = await createClient().from("students").select("id").eq("id", id).maybeSingle();
  return !!data;
}

export type DuplicateHit = { id: string; full_name: string; phone: string | null; email: string | null; passport_no: string | null; match: string };

export async function findDuplicates(input: { phone?: string; email?: string; passport?: string; excludeId?: string }): Promise<DuplicateHit[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  const { data } = await createClient().rpc("find_student_duplicates", {
    p_phone: input.phone ?? "",
    p_email: input.email ?? "",
    p_passport: input.passport ?? "",
    p_exclude: input.excludeId && /^[0-9a-f-]{36}$/i.test(input.excludeId) ? input.excludeId : null,
  });
  return (data ?? []) as DuplicateHit[];
}

export async function changeStudentStatus(input: z.input<typeof statusChangeSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("students", "edit");
    const v = statusChangeSchema.parse(input);
    const supabase = createClient();
    must(await supabase.from("students").update({ status: v.status }).eq("id", v.id));
    if (v.note) {
      // attach the note to the history row the trigger just wrote
      const last = must(await supabase.from("student_status_history").select("id").eq("student_id", v.id).order("changed_at", { ascending: false }).limit(1).single()) as { id: string };
      await supabase.rpc("annotate_status_history", { p_id: last.id, p_note: v.note });
    }
    revalidatePath(`/students/${v.id}`);
    revalidatePath("/students");
    return null;
  }, "Status updated");
}

export async function softDeleteStudent(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("students", "delete");
    must(await createClient().from("students").update({ deleted_at: new Date().toISOString() }).eq("id", z.string().uuid().parse(id)));
    revalidatePath("/students");
    return null;
  }, "Student moved to Deleted items");
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
export async function registerStudentDocument(input: z.input<typeof documentSchema>): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const me = await getCurrentUser();
    if (!me) throw new ForbiddenError();
    const v = documentSchema.parse(input);
    if (!v.file_path.startsWith(`${v.student_id}/`)) throw new Error("Invalid file location.");
    if (v.mime_type && !ALLOWED_MIME.includes(v.mime_type)) throw new Error("This file type isn't allowed. Use images, PDF, Word or Excel.");
    // staff need students:edit; students may upload only to their own record (enforced again by RLS)
    const supabase = createClient();
    const row = must(
      await supabase
        .from("student_documents")
        .insert({ student_id: v.student_id, category: v.category, file_path: v.file_path, file_name: v.file_name, mime_type: nul(v.mime_type), size_bytes: v.size_bytes, expiry_date: nul(v.expiry_date) })
        .select("id")
        .single(),
    ) as { id: string };
    if (v.category === "Photo" && v.mime_type?.startsWith("image/") && me.portal === "staff") {
      // first uploaded photo becomes the profile photo
      await supabase.from("students").update({ photo_path: v.file_path }).eq("id", v.student_id).is("photo_path", null);
    }
    revalidatePath(`/students/${v.student_id}`);
    revalidatePath("/portal");
    return { id: row.id };
  }, "File uploaded");
}

export async function deleteStudentDocument(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("students", "edit");
    const supabase = createClient();
    const doc = must(await supabase.from("student_documents").select("student_id, file_path").eq("id", id).single()) as { student_id: string; file_path: string };
    must(await supabase.from("student_documents").delete().eq("id", id));
    await supabase.storage.from("student-files").remove([doc.file_path]);
    revalidatePath(`/students/${doc.student_id}`);
    return null;
  }, "File deleted");
}

export async function setStudentPhoto(studentId: string, path: string | null): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("students", "edit");
    if (path && !path.startsWith(`${studentId}/`)) throw new Error("Invalid file location.");
    must(await createClient().from("students").update({ photo_path: path }).eq("id", studentId));
    revalidatePath(`/students/${studentId}`);
    return null;
  }, "Photo updated");
}
