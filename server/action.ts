import "server-only";
import { ZodError, type ZodSchema, type z } from "zod";
import { ForbiddenError } from "./auth";

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

type PgLikeError = { code?: string; message?: string; details?: string; hint?: string };

/** Translate database errors into messages a user can act on. */
export function friendlyError(e: unknown): string {
  if (e instanceof ForbiddenError) return e.message;
  if (e instanceof ZodError) return e.issues[0]?.message ?? "Please check the form.";
  const err = e as PgLikeError;
  switch (err?.code) {
    case "23505":
      if (err.message?.includes("uq_sprints_one_active")) return "Only one sprint can be active at a time. Complete the current active sprint first.";
      if (err.message?.includes("uq_applications_student_offer")) return "This student has already applied to that offer.";
      return "A record with the same value already exists.";
    case "23503":
      return "This record is linked to other data and can't be changed that way.";
    case "23514":
      return "One of the values is not allowed.";
    case "42501":
      return "You don't have permission to do that.";
    case "PGRST116":
      return "Record not found or you don't have access to it.";
  }
  if (err?.message?.toLowerCase().includes("row-level security")) return "You don't have permission to do that.";
  console.error("[action error]", e);
  return err?.message || "Something went wrong. Please try again.";
}

/** Run a mutation, mapping thrown errors to an ActionResult. */
export async function run<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message };
  } catch (e) {
    if (e instanceof ZodError) {
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: e.flatten().fieldErrors as Record<string, string[]> };
    }
    return { ok: false, error: friendlyError(e) };
  }
}

export function parse<S extends ZodSchema>(schema: S, input: unknown): z.infer<S> {
  return schema.parse(input);
}

/** Throw the Supabase error if present, otherwise return data. */
export function must<T>(res: { data: T; error: unknown }): NonNullable<T> {
  if (res.error) throw res.error;
  return res.data as NonNullable<T>;
}
