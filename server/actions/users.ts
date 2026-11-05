"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { assertSystemAdmin } from "@/server/auth";
import { must, run, type ActionResult } from "@/server/action";
import { resetPasswordSchema, roleSchema, userCreateSchema, userUpdateSchema } from "@/lib/validation/admin";
import { LOCKED_MODULES } from "@/lib/permissions";

async function linkStudent(userId: string, studentId: string | undefined) {
  const supabase = createClient();
  // unlink any previous student record for this user, then link the chosen one
  must(await supabase.from("students").update({ user_id: null }).eq("user_id", userId));
  if (studentId) must(await supabase.from("students").update({ user_id: userId }).eq("id", studentId));
}

export async function createUser(input: z.input<typeof userCreateSchema>): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    await assertSystemAdmin();
    const v = userCreateSchema.parse(input);
    const admin = createServiceClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: v.email,
      password: v.password,
      email_confirm: true,
      user_metadata: { full_name: v.full_name },
    });
    if (error) throw new Error(error.message.includes("already") ? "A user with this email already exists." : error.message);
    // insert profile as the System Admin so the audit log records who did it
    const supabase = createClient();
    const res = await supabase.from("profiles").insert({ id: data.user.id, full_name: v.full_name, email: v.email, phone: v.phone ?? null, role_id: v.role_id });
    if (res.error) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw res.error;
    }
    await linkStudent(data.user.id, v.student_id);
    revalidatePath("/admin/users");
    return { id: data.user.id };
  }, "User created");
}

export async function updateUser(input: z.input<typeof userUpdateSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const me = await assertSystemAdmin();
    const v = userUpdateSchema.parse(input);
    const supabase = createClient();
    if (v.id === me.id) {
      const { data: r } = await supabase.from("roles").select("key").eq("id", v.role_id).single();
      if (r?.key !== "system_admin") throw new Error("You can't remove your own System Administrator role.");
    }
    must(await supabase.from("profiles").update({ full_name: v.full_name, phone: v.phone ?? null, role_id: v.role_id }).eq("id", v.id));
    await linkStudent(v.id, v.student_id);
    revalidatePath("/admin/users");
    return null;
  }, "User updated");
}

export async function setUserActive(id: string, active: boolean): Promise<ActionResult<null>> {
  return run(async () => {
    const me = await assertSystemAdmin();
    z.string().uuid().parse(id);
    if (id === me.id && !active) throw new Error("You can't deactivate your own account.");
    const supabase = createClient();
    must(await supabase.from("profiles").update({ is_active: active, deleted_at: active ? null : new Date().toISOString() }).eq("id", id));
    // ban in Supabase Auth too so existing refresh tokens stop working
    const admin = createServiceClient();
    await admin.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
    revalidatePath("/admin/users");
    return null;
  }, active ? "User reactivated" : "User deactivated");
}

export async function resetUserPassword(input: z.input<typeof resetPasswordSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    await assertSystemAdmin();
    const v = resetPasswordSchema.parse(input);
    const { error } = await createServiceClient().auth.admin.updateUserById(v.id, { password: v.password });
    if (error) throw error;
    return null;
  }, "Password reset. Share the new password with the user securely.");
}

export async function sendResetEmail(email: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertSystemAdmin();
    const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const { error } = await createClient().auth.resetPasswordForEmail(z.string().email().parse(email), {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });
    if (error) throw error;
    return null;
  }, "Reset email sent");
}

// ---------------------------------------------------------------------------
// Roles & permissions
// ---------------------------------------------------------------------------
export async function saveRole(input: z.input<typeof roleSchema>): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    await assertSystemAdmin();
    const v = roleSchema.parse(input);
    const supabase = createClient();
    if (v.id) {
      must(await supabase.from("roles").update({ name: v.name, description: v.description ?? null }).eq("id", v.id));
      revalidatePath("/admin/roles");
      return { id: v.id };
    }
    const key = v.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") + "_" + Math.random().toString(36).slice(2, 6);
    const row = must(await supabase.from("roles").insert({ key, name: v.name, description: v.description ?? null, portal: v.portal }).select("id").single());
    revalidatePath("/admin/roles");
    return { id: (row as { id: string }).id };
  }, "Role saved");
}

export async function deleteRole(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertSystemAdmin();
    const supabase = createClient();
    const role = must(await supabase.from("roles").select("is_system").eq("id", id).single()) as { is_system: boolean };
    if (role.is_system) throw new Error("Built-in roles can't be deleted.");
    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role_id", id);
    if (count) throw new Error(`This role is assigned to ${count} user(s). Reassign them first.`);
    must(await supabase.from("roles").delete().eq("id", id));
    revalidatePath("/admin/roles");
    return null;
  }, "Role deleted");
}

export async function setRolePermissions(roleId: string, permissionIds: string[]): Promise<ActionResult<null>> {
  return run(async () => {
    await assertSystemAdmin();
    z.string().uuid().parse(roleId);
    z.array(z.string().uuid()).parse(permissionIds);
    const supabase = createClient();
    const role = must(await supabase.from("roles").select("key").eq("id", roleId).single()) as { key: string };
    if (role.key === "system_admin") throw new Error("The System Administrator always has every permission.");
    const perms = must(await supabase.from("permissions").select("id, module").in("id", permissionIds.length ? permissionIds : ["00000000-0000-0000-0000-000000000000"])) as { id: string; module: string }[];
    const allowed = perms.filter((p) => !LOCKED_MODULES.includes(p.module as never)).map((p) => p.id);
    must(await supabase.from("role_permissions").delete().eq("role_id", roleId));
    if (allowed.length) must(await supabase.from("role_permissions").insert(allowed.map((permission_id) => ({ role_id: roleId, permission_id }))));
    revalidatePath("/admin/roles");
    return null;
  }, "Permissions saved");
}
