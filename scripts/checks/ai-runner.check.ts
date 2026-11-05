/** Runs the assistant's guard + read-only runner against the seeded DB (no Anthropic key needed). */
import Module from "node:module";
import { config } from "dotenv";
config({ path: ".env.local" });
const M = Module as unknown as { _load: (r: string, ...a: unknown[]) => unknown };
const orig = M._load; M._load = (r: string, ...a: unknown[]) => (r === "server-only" ? {} : orig(r, ...a));
const { guardSql } = require("../../server/ai/sql-guard") as typeof import("../../server/ai/sql-guard");
const { runReadOnly } = require("../../server/ai/run-query") as typeof import("../../server/ai/run-query");
import { Client } from "pg";

const staffViews = ["v_students", "v_student_status_history", "v_applications", "v_offers", "v_universities", "v_tasks", "v_finance", "v_fee_dues"];
const QUESTIONS: [string, string][] = [
  ["Students registered this year", "select count(*) as students from v_students where extract(year from registered_date) = extract(year from current_date)"],
  ["Visa rejected in 2026", "select count(distinct student_id) as rejected from v_student_status_history where to_status = 'visa_rejected' and extract(year from changed_date) = 2026"],
  ["Most acceptances", "select university_name, count(*) as acceptances from v_applications where status = 'accepted' group by 1 order by 2 desc limit 3"],
  ["Passports expiring in 6 months", "select full_name, passport_no, passport_expiry_date from v_students where passport_expiry_date between current_date and current_date + interval '6 months' order by 3"],
  ["Profit last month", "select sum(amount_bdt) filter (where type='income') - sum(amount_bdt) filter (where type='expense') as profit from v_finance where txn_date >= date_trunc('month', current_date) - interval '1 month' and txn_date < date_trunc('month', current_date)"],
];
(async () => {
  let fail = 0;
  for (const [q, sql] of QUESTIONS) {
    const g = guardSql(sql, staffViews);
    if (!g.ok) { fail++; console.log("FAIL guard", q, g.error); continue; }
    const r = await runReadOnly(g.sql, "00000000-0000-0000-0000-000000000000");
    console.log(`PASS  ${q}: ${JSON.stringify(r.rows.slice(0, 3))}`);
  }
  // student scoping via app.user_id
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }); await db.connect();
  const sid = (await db.query("select id from profiles where email = 'student@crm.test'")).rows[0].id; await db.end();
  const g = guardSql("select full_name, status from v_my_student", ["v_my_student"]);
  const mine = await runReadOnly((g as { sql: string }).sql, sid);
  const ok = mine.rows.length === 1 && mine.rows[0][0] === "Rafiul Islam";
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  student scoping v_my_student -> ${JSON.stringify(mine.rows)}`);
  try { await runReadOnly("select * from students limit 1", sid); fail++; console.log("FAIL  base table readable"); }
  catch (e) { console.log("PASS  base table blocked even if guard bypassed:", (e as Error).message); }
  process.exit(fail ? 1 : 0);
})();
