"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/server/auth";
import { must, run, type ActionResult } from "@/server/action";

const TABLES = ["students", "offers", "tasks", "transactions"] as const;

/** Restore a soft-deleted record (Admin only via trash:edit; RLS checks it again). */
export async function restoreItem(table: (typeof TABLES)[number], id: string): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("trash", "edit");
    if (!TABLES.includes(table)) throw new Error("Unknown record type");
    const res = must(await createClient().from(table).update({ deleted_at: null }).eq("id", z.string().uuid().parse(id)).select("id")) as { id: string }[];
    if (!res.length) throw new Error("Record not found or you don't have permission to restore it.");
    revalidatePath("/trash");
    revalidatePath(`/${table === "transactions" ? "finance/transactions" : table}`);
    return null;
  }, "Restored");
}
