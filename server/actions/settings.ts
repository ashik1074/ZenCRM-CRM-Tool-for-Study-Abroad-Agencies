"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/server/auth";
import { must, run, type ActionResult } from "@/server/action";

const list = z.array(z.string().trim().min(1).max(80)).max(100).transform((a) => Array.from(new Set(a)));
const SCHEMAS = {
  agency: z.object({
    name: z.string().trim().min(2, "Agency name is required").max(120),
    phone: z.string().trim().max(40).optional(),
    email: z.string().trim().max(120).optional(),
    address: z.string().trim().max(300).optional(),
    logo_path: z.string().max(500).nullable().optional(),
  }),
  default_currency: z.enum(["BDT", "CNY", "USD"]),
  intakes: list,
  lead_sources: list,
  document_categories: list,
  required_documents: list,
} as const;
export type SettingKey = keyof typeof SCHEMAS;

export async function saveSetting(key: SettingKey, value: unknown): Promise<ActionResult<null>> {
  return run(async () => {
    const me = await assertPermission("settings", "edit");
    const schema = SCHEMAS[key];
    if (!schema) throw new Error("Unknown setting");
    const v = schema.parse(value);
    must(await createClient().from("settings").upsert({ key, value: v, updated_by: me.id }));
    revalidatePath("/", "layout");
    return null;
  }, "Settings saved");
}

const rateSchema = z.object({
  currency: z.enum(["CNY", "USD"]),
  rate_to_bdt: z.union([z.string(), z.number()]).refine((v) => Number(v) > 0, "Rate must be greater than 0"),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
});

export async function addExchangeRate(input: z.input<typeof rateSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    await assertPermission("settings", "edit");
    const v = rateSchema.parse(input);
    must(await createClient().from("exchange_rates").upsert({ currency: v.currency, rate_to_bdt: Number(v.rate_to_bdt), effective_date: v.effective_date }, { onConflict: "currency,effective_date" }));
    revalidatePath("/settings");
    return null;
  }, "Exchange rate saved");
}
