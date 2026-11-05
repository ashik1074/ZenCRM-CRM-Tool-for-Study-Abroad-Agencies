/** Sanity checks for the AI SQL guard: npx tsx scripts/checks/sql-guard.check.ts */
import Module from "node:module";
// allow importing a "server-only" module from a plain script
const origLoad = (Module as unknown as { _load: (r: string, ...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: (r: string, ...a: unknown[]) => unknown })._load = (r: string, ...a: unknown[]) => (r === "server-only" ? {} : origLoad(r, ...a));
const { guardSql } = require("../../server/ai/sql-guard") as typeof import("../../server/ai/sql-guard");

const allowed = ["v_students", "v_student_status_history", "v_applications"];
const cases: [string, boolean][] = [
  ["select count(*) from v_students where extract(year from registered_date) = 2026", true],
  ["with r as (select student_id from v_student_status_history where to_status='visa_rejected') select count(distinct student_id) from r", true],
  ["select university_name, count(*) from v_applications where status='accepted' group by 1 order by 2 desc", true],
  ["select * from v_finance", false],
  ["select * from students", false],
  ["select * from auth.users", false],
  ["delete from v_students", false],
  ["select 1; drop table students", false],
  ["select set_config('app.user_id','x',true), * from v_students", false],
  ["select pg_sleep(10) from v_students", false],
  ["select * from v_students -- comment", false],
  ["select * from pg_catalog.pg_roles", false],
  ["select * from v_students s join profiles p on true", false],
];
let fail = 0;
for (const [sql, expect] of cases) {
  const r = guardSql(sql, allowed);
  const ok = r.ok === expect;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${expect ? "allow" : "block"}  ${sql}${r.ok ? "" : `  -> ${r.error}`}`);
}
process.exit(fail ? 1 : 0);
