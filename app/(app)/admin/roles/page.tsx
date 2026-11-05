import { requireSystemAdmin } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { RolesClient } from "./roles-client";

export const metadata = { title: "Roles & permissions" };

export default async function RolesPage() {
  await requireSystemAdmin();
  const supabase = createClient();
  const [{ data: roles }, { data: perms }, { data: grants }, { data: profiles }] = await Promise.all([
    supabase.from("roles").select("id, key, name, description, is_system, portal").is("deleted_at", null).order("created_at"),
    supabase.from("permissions").select("id, module, action"),
    supabase.from("role_permissions").select("role_id, permission_id"),
    supabase.from("profiles").select("role_id"),
  ]);
  const userCounts: Record<string, number> = {};
  (profiles ?? []).forEach((p: { role_id: string }) => (userCounts[p.role_id] = (userCounts[p.role_id] ?? 0) + 1));
  return (
    <>
      <PageHeader title="Roles & permissions" description="Choose what each role can view, create, edit, delete and export. Changes apply on the user's next page load." />
      <RolesClient
        roles={(roles ?? []) as never}
        permissions={(perms ?? []) as never}
        grants={(grants ?? []) as never}
        userCounts={userCounts}
      />
    </>
  );
}
