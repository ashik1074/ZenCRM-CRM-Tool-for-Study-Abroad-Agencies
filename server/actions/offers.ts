"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/server/auth";
import { must, run, type ActionResult } from "@/server/action";
import { nul, numOrNull } from "@/lib/validation/common";
import { applicationSchema, applicationStatusSchema, offerSchema, universitySchema, type OfferInput, type UniversityInput } from "@/lib/validation/offers";
import { ALLOWED_MIME, MAX_FILE_BYTES } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Universities
// ---------------------------------------------------------------------------
export async function saveUniversity(input: UniversityInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const v = universitySchema.parse(input);
    await assertPermission("universities", v.id ? "edit" : "create");
    const row = {
      name: v.name, city: nul(v.city), province: nul(v.province), ranking: numOrNull(v.ranking), website: nul(v.website),
      contact_person: nul(v.contact_person), email: nul(v.email), phone: nul(v.phone), notes: nul(v.notes), is_active: v.is_active,
    };
    const supabase = createClient();
    const res = v.id
      ? must(await supabase.from("universities").update(row).eq("id", v.id).select("id").single())
      : must(await supabase.from("universities").insert(row).select("id").single());
    revalidatePath("/universities");
    return res as { id: string };
  }, "University saved");
}

export async function deleteUniversity(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("universities", "delete");
    const supabase = createClient();
    const { count } = await supabase.from("offers").select("id", { count: "exact", head: true }).eq("university_id", id).is("deleted_at", null);
    if (count) throw new Error(`This university has ${count} offer(s). Mark it inactive instead, or delete the offers first.`);
    must(await supabase.from("universities").update({ deleted_at: new Date().toISOString() }).eq("id", id));
    revalidatePath("/universities");
    return null;
  }, "University deleted");
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------
export async function saveOffer(input: OfferInput, attachments: { file_path: string; file_name: string; mime_type: string; size_bytes: number }[] = []): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const v = offerSchema.parse(input);
    const supabase = createClient();
    // new offers carry a client-generated id (so leaflets can be uploaded first); decide by existence
    const isUuid = /^[0-9a-f-]{36}$/i.test(v.id ?? "");
    const exists = isUuid && !!(await supabase.from("offers").select("id").eq("id", v.id!).maybeSingle()).data;
    await assertPermission("offers", exists ? "edit" : "create");
    const row = {
      title: v.title, university_id: v.university_id, program: v.program, degree_level: v.degree_level, intake: nul(v.intake),
      scholarship_type: nul(v.scholarship_type), covers_tuition: v.covers_tuition, covers_accommodation: v.covers_accommodation,
      stipend_amount: numOrNull(v.stipend_amount), stipend_currency: v.stipend_currency, tuition_fee: numOrNull(v.tuition_fee),
      accommodation_fee: numOrNull(v.accommodation_fee), fee_currency: v.fee_currency, application_deadline: nul(v.application_deadline),
      language_of_instruction: nul(v.language_of_instruction), eligibility: nul(v.eligibility), source: v.source,
      partner_name: v.source === "partner_agent" ? nul(v.partner_name) : null,
      // re-opening an offer whose deadline passed is blocked by the expiry trigger; that's intended
      status: v.status === "expired" ? "open" : v.status,
    };
    const saved = (exists
      ? must(await supabase.from("offers").update(row).eq("id", v.id!).select("id").single())
      : must(await supabase.from("offers").insert({ ...row, id: isUuid ? v.id : undefined }).select("id").single())) as { id: string };
    await addAttachments(saved.id, attachments);
    revalidatePath("/offers");
    return saved;
  }, "Offer saved");
}

async function addAttachments(offerId: string, files: { file_path: string; file_name: string; mime_type: string; size_bytes: number }[]) {
  if (!files.length) return;
  for (const f of files) {
    if (!f.file_path.startsWith(`${offerId}/`)) throw new Error("Invalid file location.");
    if (!ALLOWED_MIME.includes(f.mime_type) || f.size_bytes > MAX_FILE_BYTES) throw new Error(`${f.file_name}: file type or size not allowed.`);
  }
  must(await createClient().from("offer_attachments").insert(files.map((f) => ({ ...f, offer_id: offerId }))));
}

export async function addOfferAttachment(offerId: string, file: { file_path: string; file_name: string; mime_type: string; size_bytes: number }): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("offers", "edit");
    await addAttachments(offerId, [file]);
    revalidatePath("/offers");
    return null;
  }, "Leaflet uploaded");
}

export async function deleteOfferAttachment(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("offers", "edit");
    const supabase = createClient();
    const a = must(await supabase.from("offer_attachments").select("file_path").eq("id", id).single()) as { file_path: string };
    must(await supabase.from("offer_attachments").delete().eq("id", id));
    await supabase.storage.from("offer-leaflets").remove([a.file_path]);
    revalidatePath("/offers");
    return null;
  }, "Leaflet deleted");
}

export async function deleteOffer(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("offers", "delete");
    must(await createClient().from("offers").update({ deleted_at: new Date().toISOString() }).eq("id", z.string().uuid().parse(id)));
    revalidatePath("/offers");
    return null;
  }, "Offer moved to Deleted items");
}

export async function getOfferDetail(id: string) {
  await assertPermission("offers", "view");
  const supabase = createClient();
  const { data } = await supabase
    .from("offers")
    .select("*, university:universities(id, name, city, province, website), attachments:offer_attachments(id, file_path, file_name, mime_type, size_bytes, created_at), apps:applications(count)")
    .eq("id", z.string().uuid().parse(id))
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

// ---------------------------------------------------------------------------
// Applications (student ↔ offer)
// ---------------------------------------------------------------------------
export async function applyToOffer(input: z.input<typeof applicationSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("applications", "create");
    const v = applicationSchema.parse(input);
    const supabase = createClient();
    const offer = must(await supabase.from("offers").select("university_id, status").eq("id", v.offer_id).single()) as { university_id: string; status: string };
    if (offer.status !== "open") throw new Error("This offer is no longer open.");
    must(await supabase.from("applications").insert({
      student_id: v.student_id, offer_id: v.offer_id, university_id: offer.university_id,
      applied_at: nul(v.applied_at) ?? undefined, notes: nul(v.notes),
    }));
    // move early-stage students to "applied"
    await supabase.from("students").update({ status: "applied" }).eq("id", v.student_id).in("status", ["inquiry", "registered", "documents_collecting"]);
    revalidatePath(`/students/${v.student_id}`);
    return null;
  }, "Application created");
}

export async function setApplicationStatus(input: z.input<typeof applicationStatusSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("applications", "edit");
    const v = applicationStatusSchema.parse(input);
    const supabase = createClient();
    const app = must(await supabase.from("applications").update({ status: v.status }).eq("id", v.id).select("student_id").single()) as { student_id: string };
    if (v.status === "accepted") {
      await supabase.from("students").update({ status: "offer_received" }).eq("id", app.student_id).in("status", ["inquiry", "registered", "documents_collecting", "applied"]);
    }
    revalidatePath(`/students/${app.student_id}`);
    return null;
  }, "Application updated");
}

export async function deleteApplication(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("applications", "delete");
    const supabase = createClient();
    const app = must(await supabase.from("applications").update({ deleted_at: new Date().toISOString() }).eq("id", id).select("student_id").single()) as { student_id: string };
    revalidatePath(`/students/${app.student_id}`);
    return null;
  }, "Application removed");
}
