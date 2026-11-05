import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import type { CurrentUser } from "@/server/auth";
import { ApplicationsClient, type AppRow } from "./applications-client";

export async function ApplicationsTab({ studentId, user }: { studentId: string; user: CurrentUser }) {
  const supabase = createClient();
  const [{ data: apps }, { data: offers }] = await Promise.all([
    supabase
      .from("applications")
      .select("id, status, applied_at, decision_at, notes, offer:offers(id, title, program, degree_level, intake, scholarship_type), university:universities(name, city)")
      .eq("student_id", studentId)
      .is("deleted_at", null)
      .order("applied_at", { ascending: false }),
    can(user.permissions, "applications", "create")
      ? supabase.from("offers").select("id, title, program, intake, application_deadline, university:universities(name)").eq("status", "open").is("deleted_at", null).order("application_deadline").limit(500)
      : Promise.resolve({ data: [] }),
  ]);
  return (
    <ApplicationsClient
      studentId={studentId}
      apps={(apps ?? []) as unknown as AppRow[]}
      offers={(offers ?? []) as never}
      perms={{
        create: can(user.permissions, "applications", "create"),
        edit: can(user.permissions, "applications", "edit"),
        delete: can(user.permissions, "applications", "delete"),
      }}
    />
  );
}
