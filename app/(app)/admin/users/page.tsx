import { requireSystemAdmin } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { UsersClient, type UserRow } from "./users-client";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  await requireSystemAdmin();
  const supabase = createClient();
  const [{ data: users }, { data: roles }, { data: students }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, phone, is_active, last_login_at, created_at, role_id, roles(name, key)").order("full_name"),
    supabase.from("roles").select("id, name, key, portal").is("deleted_at", null).order("name"),
    supabase.from("students").select("id, full_name, student_code, user_id").is("deleted_at", null).order("full_name").limit(1000),
  ]);
  return (
    <>
      <PageHeader title="Users" description="Create accounts, assign roles, reset passwords and deactivate users." />
      <UsersClient
        users={(users ?? []) as unknown as UserRow[]}
        roles={(roles ?? []) as { id: string; name: string; key: string; portal: string }[]}
        students={(students ?? []) as { id: string; full_name: string; student_code: string; user_id: string | null }[]}
      />
    </>
  );
}
