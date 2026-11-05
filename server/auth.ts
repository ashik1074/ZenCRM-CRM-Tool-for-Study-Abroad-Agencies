import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, type Action, type Module } from "@/lib/permissions";

export type CurrentUser = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_path: string | null;
  is_active: boolean;
  role_key: string;
  role_name: string;
  portal: "staff" | "student";
  permissions: string[];
};

/** Current user + permissions, memoised for the request. Returns null when signed out or inactive. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc("my_context");
  if (error || !data) return null;
  const ctx = data as CurrentUser;
  if (!ctx.is_active) return null;
  return ctx;
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** For server actions / route handlers: throws ForbiddenError when the permission is missing. */
export async function assertPermission(module: Module, action: Action = "view"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Your session has expired. Please sign in again.");
  if (!can(user.permissions, module, action)) throw new ForbiddenError();
  return user;
}

/** For pages: redirects to /403 when missing (middleware already returns a real 403 for known routes). */
export async function requirePagePermission(module: Module, action: Action = "view"): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.permissions, module, action)) redirect("/403");
  return user;
}

export async function requireSystemAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role_key !== "system_admin") redirect("/403");
  return user;
}

export async function assertSystemAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.role_key !== "system_admin") throw new ForbiddenError("Only the System Administrator can manage users and roles.");
  return user;
}
