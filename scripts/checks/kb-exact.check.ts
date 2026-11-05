/** Verifies the seeded visa checklist in the DB is byte-identical to supabase/seed/visa-interview-checklist.txt */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { Client } from "pg";

config({ path: ".env.local" });

async function main() {
  const expected = readFileSync("supabase/seed/visa-interview-checklist.txt", "utf8");
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const { rows } = await db.query("select body, body_text, body_format, category from public.kb_entries where title = 'Document Checklist for Visa Interview' and deleted_at is null");
  await db.end();
  if (!rows.length) throw new Error("Entry not found");
  const r = rows[0];
  const ok = r.body === expected && r.body_text === expected && r.body_format === "text" && r.category === "Visa";
  console.log(ok ? `PASS  checklist is byte-identical (${expected.length} chars, ${expected.split("\n").length} lines)` : "FAIL  checklist differs from the source file");
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
