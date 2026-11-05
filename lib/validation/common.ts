import { z } from "zod";

/** Form-friendly primitives: forms submit strings; servers normalise "" → null. */
export const str = (max = 300) => z.string().trim().max(max, `Keep it under ${max} characters`);
export const optStr = (max = 300) => str(max).optional().default("");
export const reqStr = (label: string, max = 300) => str(max).min(1, `${label} is required`);
export const optDate = z
  .string()
  .optional()
  .default("")
  .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date");
export const reqDate = (label: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} is required`);
export const optUuid = z
  .string()
  .optional()
  .default("")
  .refine((v) => !v || /^[0-9a-f-]{36}$/i.test(v), "Invalid selection");
export const optNum = z
  .union([z.string(), z.number()])
  .optional()
  .default("")
  .refine((v) => v === "" || v === undefined || !Number.isNaN(Number(v)), "Enter a number");
export const money = (label = "Amount") =>
  z.union([z.string(), z.number()]).refine((v) => v !== "" && Number(v) > 0 && Number(v) < 1e12, `${label} must be greater than 0`);

export const nul = (v: string | undefined | null) => (v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim());
export const numOrNull = (v: string | number | undefined | null) => (v === "" || v === undefined || v === null ? null : Number(v));
export const csv = (v: string | undefined | null) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
