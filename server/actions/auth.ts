"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/server/action";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  next: z.string().optional(),
});

export async function signIn(input: z.infer<typeof loginSchema>): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { email, password, next } = parsed.data;
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    const banned = error?.message?.toLowerCase().includes("banned");
    return { ok: false, error: banned ? "This account has been deactivated. Contact your administrator." : "Invalid email or password." };
  }
  const { data: ctx } = await supabase.rpc("my_context");
  const c = ctx as { is_active: boolean; portal: string } | null;
  if (!c || !c.is_active) {
    await supabase.auth.signOut();
    return { ok: false, error: "This account has been deactivated. Contact your administrator." };
  }
  // last login is written with the service client because users cannot update their own audit fields
  await createServiceClient().from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", data.user.id);
  const home = c.portal === "student" ? "/portal" : "/dashboard";
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const redirectTo = safeNext && (c.portal === "student" ? safeNext.startsWith("/portal") : !safeNext.startsWith("/portal")) ? safeNext : home;
  return { ok: true, data: { redirectTo } };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(email: string): Promise<ActionResult<null>> {
  const parsed = z.string().trim().email("Enter a valid email address").safeParse(email);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const origin = process.env.NEXT_PUBLIC_SITE_URL || headers().get("origin") || "http://localhost:3000";
  const supabase = createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${origin}/auth/callback?next=/reset-password` });
  // Always succeed so we don't reveal which emails exist
  return { ok: true, data: null, message: "If that email is registered, a reset link is on its way." };
}

const newPasswordSchema = z
  .object({ password: z.string().min(8, "Use at least 8 characters"), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

export async function updatePassword(input: z.infer<typeof newPasswordSchema>): Promise<ActionResult<null>> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: "Your reset link has expired. Request a new one." };
  return { ok: true, data: null, message: "Password updated." };
}
