"use server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/server/auth";
import { can } from "@/lib/permissions";
import { ilikeTerm } from "@/lib/url";

export type StudentOption = { id: string; full_name: string; student_code: string; phone: string | null };

/** Typeahead for student pickers (tasks, finance). Requires students:view; RLS applies. */
export async function searchStudents(q: string): Promise<StudentOption[]> {
  const me = await getCurrentUser();
  if (!me || !can(me.permissions, "students", "view")) return [];
  let query = createClient().from("students").select("id, full_name, student_code, phone").is("deleted_at", null).order("full_name").limit(15);
  if (q.trim()) {
    const t = ilikeTerm(q.trim().slice(0, 60));
    query = query.or(`full_name.ilike.${t},phone.ilike.${t},student_code.ilike.${t},passport_no.ilike.${t}`);
  }
  const { data } = await query;
  return (data ?? []) as StudentOption[];
}
