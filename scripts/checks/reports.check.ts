/** Calls every report/dashboard RPC as Admin to catch runtime SQL errors: npx tsx scripts/checks/reports.check.ts */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });
(async () => {
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email: "admin@crm.test", password: "Admin#2026" });
  const r = { p_from: "2025-11-01", p_to: "2026-11-30" };
  const { data: one } = await c.from("students").select("id").limit(1).single();
  const calls: [string, Record<string, unknown>][] = [
    ["dashboard_stats", {}], ["upcoming_deadlines", { p_limit: 10 }], ["my_recent_activity", { p_limit: 10 }],
    ["report_university", r], ["report_enrollment_trend", { ...r, p_grain: "month" }], ["report_enrollment_trend", { ...r, p_grain: "year" }],
    ["report_funnel", r], ["report_visa", r], ["report_counselors", r], ["report_lead_sources", r], ["report_offers", r], ["report_finance", r],
    ["student_checklist", { p_student: one!.id }], ["student_activity", { p_student: one!.id, p_limit: 20 }],
    ["find_student_duplicates", { p_phone: "+8801812345678", p_email: "", p_passport: "" }], ["global_search", { p_q: "zhej" }],
    ["generate_scheduled_notifications", {}], ["expire_offers", {}],
  ];
  let fail = 0;
  for (const [fn, args] of calls) {
    const { data, error } = await c.rpc(fn, args);
    if (error) fail++;
    const summary = error ? error.message : Array.isArray(data) ? `${data.length} rows` : JSON.stringify(data)?.slice(0, 140);
    console.log(`${error ? "FAIL" : "PASS"}  ${fn}  ${summary}`);
  }
  process.exit(fail ? 1 : 0);
})();
