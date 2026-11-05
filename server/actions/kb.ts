"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/server/auth";
import { must, run, type ActionResult } from "@/server/action";
import { csv } from "@/lib/validation/common";
import { htmlToText, sanitizeHtml } from "@/lib/sanitize";
import { ALLOWED_MIME, MAX_FILE_BYTES } from "@/lib/constants";

const kbSchema = z.object({
  id: z.string().optional().default(""),
  title: z.string().trim().min(1, "Title is required").max(200),
  category: z.string().trim().min(1, "Category is required").max(60),
  body_format: z.enum(["html", "text"]).default("html"),
  body: z.string().max(200_000).default(""),
  tags: z.string().max(300).optional().default(""),
});
export type KbInput = z.input<typeof kbSchema>;

export async function saveKbEntry(input: KbInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const v = kbSchema.parse(input);
    await assertPermission("kb", v.id ? "edit" : "create");
    // plain-text entries (like the visa checklist) are stored verbatim, never reformatted
    const body = v.body_format === "html" ? sanitizeHtml(v.body) : v.body;
    const row = {
      title: v.title,
      category: v.category,
      body_format: v.body_format,
      body,
      body_text: v.body_format === "html" ? htmlToText(body) : body,
      tags: csv(v.tags).map((t) => t.toLowerCase()),
    };
    const supabase = createClient();
    const res = v.id
      ? must(await supabase.from("kb_entries").update(row).eq("id", v.id).select("id").single())
      : must(await supabase.from("kb_entries").insert(row).select("id").single());
    revalidatePath("/kb");
    return res as { id: string };
  }, "Entry saved");
}

export async function deleteKbEntry(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("kb", "delete");
    must(await createClient().from("kb_entries").update({ deleted_at: new Date().toISOString() }).eq("id", z.string().uuid().parse(id)));
    revalidatePath("/kb");
    return null;
  }, "Entry deleted");
}

export async function getKbEntry(id: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("kb_entries")
    .select("id, title, category, body, body_format, body_text, tags, updated_at, editor:profiles!kb_entries_updated_by_fkey(full_name), attachments:kb_attachments(id, file_path, file_name, mime_type, size_bytes, created_at)")
    .eq("id", z.string().uuid().parse(id))
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

export async function addKbAttachment(entryId: string, f: { file_path: string; file_name: string; mime_type: string; size_bytes: number }): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("kb", "edit");
    if (!f.file_path.startsWith(`${entryId}/`)) throw new Error("Invalid file location.");
    if (!ALLOWED_MIME.includes(f.mime_type) || f.size_bytes > MAX_FILE_BYTES) throw new Error("File type or size not allowed.");
    must(await createClient().from("kb_attachments").insert({ ...f, entry_id: entryId }));
    return null;
  }, "File attached");
}

export async function deleteKbAttachment(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("kb", "edit");
    const supabase = createClient();
    const a = must(await supabase.from("kb_attachments").select("file_path").eq("id", id).single()) as { file_path: string };
    must(await supabase.from("kb_attachments").delete().eq("id", id));
    await supabase.storage.from("kb-attachments").remove([a.file_path]);
    return null;
  }, "Attachment deleted");
}
