/** RLS checks through the real Supabase API, signed in as each seeded role: npx tsx scripts/checks/rls.check.ts */
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
let fail = 0;
const check = (name: string, ok: boolean, info = "") => { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`); };
async function as(email: string, password: string) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email}: ${error.message}`);
  return c;
}
const count = async (c: SupabaseClient, t: string) => (await c.from(t).select("id", { count: "exact", head: true })).count ?? 0;

(async () => {
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  check("anon sees no students", (await count(anon, "students")) === 0);
  check("anon cannot read AI views", !!(await anon.from("v_finance").select("*").limit(1)).error);

  const op = await as("operator@crm.test", "Operator#2026");
  check("operator sees students", (await count(op, "students")) === 40);
  check("operator sees no transactions", (await count(op, "transactions")) === 0);
  check("operator sees no fee plans", (await count(op, "fee_plans")) === 0);
  check("operator cannot run finance report", !!(await op.rpc("report_finance", { p_from: "2026-01-01", p_to: "2026-12-31" })).error);
  check("operator cannot read audit log", (await count(op, "audit_logs")) === 0);
  const me = (await op.auth.getUser()).data.user!.id;
  const { data: adminRole } = await op.from("roles").select("id").eq("key", "system_admin").single();
  await op.from("profiles").update({ role_id: adminRole!.id }).eq("id", me);
  const { data: ctx } = await op.rpc("my_context");
  check("operator cannot promote themselves", (ctx as { role_key: string }).role_key === "operator");
  check("operator insert role_permissions blocked", !!(await op.from("role_permissions").insert({ role_id: adminRole!.id, permission_id: adminRole!.id })).error);
  const { data: s } = await op.from("students").select("id").limit(1).single();
  const del = await op.from("students").delete().eq("id", s!.id).select("id");
  check("operator cannot hard-delete students", !del.data?.length);
  check("operator cannot read readonly views", !!(await op.from("v_students").select("*").limit(1)).error);

  const fin = await as("finance@crm.test", "Finance#2026");
  check("finance sees transactions", (await count(fin, "transactions")) > 50);
  check("finance can read students (read-only list)", (await count(fin, "students")) === 40);
  const upd = await fin.from("students").update({ notes: "x" }).eq("id", s!.id).select("id");
  check("finance cannot edit students", !upd.data?.length);
  check("finance sees only own tasks", (await count(fin, "tasks")) < 30);
  check("finance report works", !(await fin.rpc("report_finance", { p_from: "2026-01-01", p_to: "2026-12-31" })).error);

  const adm = await as("admin@crm.test", "Admin#2026");
  const { data: admPerms } = await adm.rpc("my_permissions");
  check("admin has no users/roles permissions", !(admPerms as string[]).some((p) => p.startsWith("users:") || p.startsWith("roles:")));
  check("admin sees audit log", (await count(adm, "audit_logs")) >= 0 && !(await adm.from("audit_logs").select("id").limit(1)).error);

  const stu = await as("student@crm.test", "Student#2026");
  check("student sees exactly 1 student (self)", (await count(stu, "students")) === 1);
  check("student sees no tasks", (await count(stu, "tasks")) === 0);
  check("student sees no offers except applied", (await count(stu, "offers")) <= 2);
  const { data: myStudent } = await stu.from("students").select("id").single();
  const { data: payments } = await stu.from("transactions").select("student_id");
  check("student sees only own payments", (payments ?? []).every((p: { student_id: string }) => p.student_id === myStudent!.id));
  check("student sees visa checklist KB", (await stu.from("kb_entries").select("id").eq("title", "Document Checklist for Visa Interview")).data?.length === 1);
  check("student cannot run reports", !!(await stu.rpc("report_university", { p_from: "2026-01-01", p_to: "2026-12-31" })).error);
  const up = await stu.storage.from("student-files").upload(`${myStudent!.id}/rls-test.txt`, new Blob(["x"], { type: "application/pdf" }), { upsert: true });
  check("student can upload to own folder", !up.error, up.error?.message);
  const other = (await op.from("students").select("id").neq("id", myStudent!.id).limit(1).single()).data!.id;
  const up2 = await stu.storage.from("student-files").upload(`${other}/rls-test.pdf`, new Blob(["x"], { type: "application/pdf" }));
  check("student cannot upload to another student's folder", !!up2.error);
  if (!up.error) await op.storage.from("student-files").remove([`${myStudent!.id}/rls-test.txt`]);

  const sys = await as("sysadmin@crm.test", "SysAdmin#2026");
  const { data: sysPerms } = await sys.rpc("my_permissions");
  check("sysadmin has users permissions", (sysPerms as string[]).includes("users:view"));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
