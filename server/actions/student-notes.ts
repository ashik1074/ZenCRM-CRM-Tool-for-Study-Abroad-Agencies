"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/server/auth";
import { must, run, type ActionResult } from "@/server/action";

const noteSchema = z.object({ student_id: z.string().uuid(), body: z.string().trim().min(1, "Write a note first").max(5000) });

export async function addStudentNote(input: z.input<typeof noteSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const me = await assertPermission("students", "view");
    const v = noteSchema.parse(input);
    must(await createClient().from("student_notes").insert({ ...v, author_id: me.id }));
    revalidatePath(`/students/${v.student_id}`);
    return null;
  }, "Note added");
}

export async function deleteStudentNote(id: string, studentId: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("students", "view");
    must(await createClient().from("student_notes").update({ deleted_at: new Date().toISOString() }).eq("id", z.string().uuid().parse(id)));
    revalidatePath(`/students/${studentId}`);
    return null;
  }, "Note deleted");
}
