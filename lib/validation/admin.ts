import { z } from "zod";

const optionalText = z.string().trim().max(200).optional().or(z.literal("").transform(() => undefined));

export const userCreateSchema = z.object({
  full_name: z.string().trim().min(2, "Enter the full name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: optionalText,
  role_id: z.string().uuid("Choose a role"),
  password: z.string().min(8, "Use at least 8 characters"),
  student_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
});

export const userUpdateSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(2, "Enter the full name").max(120),
  phone: optionalText,
  role_id: z.string().uuid("Choose a role"),
  student_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
});

export const resetPasswordSchema = z.object({
  id: z.string().uuid(),
  password: z.string().min(8, "Use at least 8 characters"),
});

export const roleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Enter a role name").max(60),
  description: z.string().trim().max(300).optional(),
  portal: z.enum(["staff", "student"]).default("staff"),
});
