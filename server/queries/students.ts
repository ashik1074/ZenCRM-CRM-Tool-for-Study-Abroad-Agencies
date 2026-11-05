import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ilikeTerm, listParams, sp, type SearchParams } from "@/lib/url";
import type { StudentFormInput } from "@/lib/validation/student";

export const STUDENT_SORTS: Record<string, string> = {
  name: "full_name",
  created: "created_at",
  status: "status",
  intake: "intake",
};

/** Builds the filtered students query used by the list page and the export endpoint. */
export function studentsQuery(params: SearchParams, select: string, opts: { count?: boolean; meId?: string } = {}) {
  const supabase = createClient();
  const { q, sort, dir } = listParams(params, { sort: "created" });
  const university = sp(params, "university");
  const sel = university ? `${select}, filter_app:applications!inner(university_id)` : select;
  let query = supabase.from("students").select(sel, opts.count ? { count: "exact" } : undefined).is("deleted_at", null);
  if (q) {
    const t = ilikeTerm(q);
    query = query.or(`full_name.ilike.${t},phone.ilike.${t},email.ilike.${t},passport_no.ilike.${t},student_code.ilike.${t}`);
  }
  const status = sp(params, "status");
  if (status === "draft") query = query.eq("is_draft", true);
  else if (status) query = query.eq("status", status);
  const counselor = sp(params, "counselor");
  if (counselor === "me") query = query.eq("counselor_id", opts.meId ?? "00000000-0000-0000-0000-000000000000");
  else if (counselor === "none") query = query.is("counselor_id", null);
  else if (counselor) query = query.eq("counselor_id", counselor);
  if (sp(params, "intake")) query = query.eq("intake", sp(params, "intake")!);
  if (sp(params, "scholarship")) query = query.eq("scholarship_type", sp(params, "scholarship")!);
  if (sp(params, "source")) query = query.eq("lead_source", sp(params, "source")!);
  if (university) query = query.eq("filter_app.university_id", university);
  if (sp(params, "from")) query = query.gte("created_at", `${sp(params, "from")}T00:00:00+06:00`);
  if (sp(params, "to")) query = query.lte("created_at", `${sp(params, "to")}T23:59:59.999+06:00`);
  query = query.order(STUDENT_SORTS[sort] ?? "created_at", { ascending: dir === "asc" });
  return query;
}

export type StudentDetail = Awaited<ReturnType<typeof getStudent>>;

export async function getStudent(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("students")
    .select(
      `*, counselor:profiles!students_counselor_id_fkey(id, full_name, phone, email),
       education:student_education(*), work:student_work_experience(*), family:student_family_members(*),
       travel:student_travel_history(*)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  type Row = Record<string, unknown> & {
    education: Record<string, unknown>[];
    work: Record<string, unknown>[];
    family: { id: string; relation: string; name: string; date_of_birth: string | null; sort_order: number }[];
    travel: { id: string; kind: string; country: string; visa_type: string | null; valid_until: string | null; visited_from: string | null; visited_to: string | null }[];
  };
  const s = data as unknown as Row;
  s.education.sort((a, b) => (a.sort_order as number) - (b.sort_order as number));
  s.family.sort((a, b) => a.sort_order - b.sort_order);
  return s as Row & {
    id: string; student_code: string; full_name: string; photo_path: string | null; status: string; is_draft: boolean;
    phone: string | null; whatsapp: string | null; email: string | null; passport_no: string | null; passport_expiry_date: string | null;
    passport_issue_date: string | null; date_of_birth: string | null; gender: string | null; intake: string | null; deleted_at: string | null;
    counselor: { id: string; full_name: string; phone: string | null; email: string } | null;
    created_at: string; updated_at: string;
  };
}

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** Map a DB student to the enrollment form's input shape. */
export function toFormInput(st: NonNullable<StudentDetail>): StudentFormInput {
  const person = (rel: string) => {
    const p = st.family.find((f) => f.relation === rel);
    return { id: p?.id ?? "", name: p?.name ?? "", date_of_birth: s(p?.date_of_birth) };
  };
  const arr = (v: unknown) => ((v as string[] | null) ?? []).join(", ");
  return {
    id: st.id,
    full_name: st.full_name,
    photo_path: s(st.photo_path),
    gender: (st.gender ?? "") as never,
    date_of_birth: s(st.date_of_birth),
    nationality: s(st.nationality),
    phone: s(st.phone),
    whatsapp: s(st.whatsapp),
    email: s(st.email),
    present_address: s(st.present_address),
    permanent_address: s(st.permanent_address),
    passport_no: s(st.passport_no),
    passport_issue_date: s(st.passport_issue_date),
    passport_expiry_date: s(st.passport_expiry_date),
    father: person("father"),
    mother: person("mother"),
    spouse: person("spouse"),
    children: st.family.filter((f) => f.relation === "child").map((c) => ({ id: c.id, name: c.name, date_of_birth: s(c.date_of_birth) })),
    education: st.education.map((e) => ({
      id: s(e.id), level: e.level as never, institution: s(e.institution), degree: s(e.degree), major: s(e.major), passing_year: s(e.passing_year), gpa: s(e.gpa),
    })),
    work: st.work.map((w) => ({
      id: s(w.id), company: s(w.company), address: s(w.address), employer_phone: s(w.employer_phone), position: s(w.position), duty: s(w.duty),
      supervisor_name: s(w.supervisor_name), supervisor_phone: s(w.supervisor_phone), start_date: s(w.start_date), end_date: s(w.end_date),
    })),
    hsk_level: s(st.hsk_level),
    ielts_score: s(st.ielts_score),
    other_language_scores: s(st.other_language_scores),
    intended_program_level: (st.intended_program_level ?? "") as never,
    preferred_majors: arr(st.preferred_majors),
    preferred_cities: arr(st.preferred_cities),
    preferred_universities: arr(st.preferred_universities),
    intake: s(st.intake),
    scholarship_type: (st.scholarship_type ?? "") as never,
    has_valid_foreign_visa: !!st.has_valid_foreign_visa,
    valid_visas: st.travel.filter((t) => t.kind === "valid_visa").map((t) => ({ id: t.id, country: t.country, visa_type: s(t.visa_type), valid_until: s(t.valid_until), visited_from: "", visited_to: "" })),
    visited_countries_past_12m: !!st.visited_countries_past_12m,
    visits: st.travel.filter((t) => t.kind === "visit").map((t) => ({ id: t.id, country: t.country, visa_type: "", valid_until: "", visited_from: s(t.visited_from), visited_to: s(t.visited_to) })),
    previous_china_visa: !!st.previous_china_visa,
    previous_china_residence: !!st.previous_china_residence,
    lead_source: s(st.lead_source),
    referred_by: s(st.referred_by),
    counselor_id: s(st.counselor_id),
    status: st.status,
    notes: s(st.notes),
  };
}

export async function getStaffOptions() {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, roles!inner(portal)")
    .eq("roles.portal", "staff")
    .eq("is_active", true)
    .order("full_name");
  return ((data ?? []) as { id: string; full_name: string }[]).map(({ id, full_name }) => ({ id, full_name }));
}
