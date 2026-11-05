/**
 * Applies SQL migrations in /supabase/migrations to DATABASE_URL.
 * Every migration is idempotent, so `npm run db:migrate -- --all` re-applies everything safely.
 * Applied files are tracked in public._migrations with a checksum; changed files are re-applied.
 */
import { config } from "dotenv";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { Client } from "pg";

config({ path: ".env.local" });
config();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  const all = process.argv.includes("--all");
  const client = new Client({ connectionString: url, ssl: url.includes("localhost") ? false : { rejectUnauthorized: false } });
  await client.connect();
  await client.query(`create table if not exists public._migrations (
    name text primary key, checksum text not null, applied_at timestamptz not null default now())`);
  await client.query(`alter table public._migrations enable row level security`);

  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const { rows } = await client.query<{ name: string; checksum: string }>("select name, checksum from public._migrations");
  const applied = new Map(rows.map((r) => [r.name, r.checksum]));

  for (const f of files) {
    const sql = readFileSync(join(dir, f), "utf8");
    const sum = createHash("sha256").update(sql).digest("hex");
    if (!all && applied.get(f) === sum) {
      console.log(`= ${f} (up to date)`);
      continue;
    }
    process.stdout.write(`> ${f} ... `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(
        `insert into public._migrations(name, checksum) values ($1,$2)
         on conflict (name) do update set checksum = excluded.checksum, applied_at = now()`,
        [f, sum],
      );
      await client.query("commit");
      console.log("ok");
    } catch (e) {
      await client.query("rollback");
      console.log("FAILED");
      throw e;
    }
  }
  await client.end();
  console.log("Migrations complete.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
