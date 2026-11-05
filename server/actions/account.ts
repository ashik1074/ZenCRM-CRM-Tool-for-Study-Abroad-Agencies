"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, ForbiddenError } from "@/server/auth";
import { must, run, type ActionResult } from "@/server/action";

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your name").max(120),
  phone: z.string().trim().max(30).optional(),
});

export async function updateMyProfile(input: z.input<typeof profileSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const me = await getCurrentUser();
    if (!me) throw new ForbiddenError();
    const v = profileSchema.parse(input);
    must(await createClient().from("profiles").update({ full_name: v.full_name, phone: v.phone || null }).eq("id", me.id));
    revalidatePath("/", "layout");
    return null;
  }, "Profile updated");
}

const pwSchema = z
  .object({ current: z.string().min(1, "Enter your current password"), password: z.string().min(8, "Use at least 8 characters"), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

export async function changeMyPassword(input: z.input<typeof pwSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const me = await getCurrentUser();
    if (!me) throw new ForbiddenError();
    const v = pwSchema.parse(input);
    const supabase = createClient();
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: me.email, password: v.current });
    if (authErr) throw new Error("Your current password is incorrect.");
    const { error } = await supabase.auth.updateUser({ password: v.password });
    if (error) throw error;
    return null;
  }, "Password changed");
}
