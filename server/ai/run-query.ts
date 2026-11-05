import "server-only";
import { Pool, types } from "pg";

// keep DATE columns as plain yyyy-mm-dd strings (no timezone shifting)
types.setTypeParser(1082, (v: string) => v);

let pool: Pool | null = null;
function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not configured on the server.");
    pool = new Pool({ connectionString: url, max: 4, ssl: url.includes("localhost") ? false : { rejectUnauthorized: false } });
  }
  return pool;
}

/**
 * Runs an already-validated SELECT as the dedicated read-only role `readonly_ai`, inside a read-only
 * transaction with a 5s timeout. `app.user_id` scopes the student self-service views. Always rolled back.
 */
export async function runReadOnly(sql: string, userId: string) {
  const client = await getPool().connect();
  try {
    await client.query("begin transaction read only");
    await client.query("set local statement_timeout = 5000");
    await client.query("select set_config('app.user_id', $1, true)", [userId]);
    await client.query("set local role readonly_ai");
    const res = await client.query({ text: sql, rowMode: "array" });
    const columns = res.fields.map((f) => f.name);
    const rows = (res.rows as unknown[][]).map((r) => r.map((v) => (v instanceof Date ? v.toISOString() : typeof v === "bigint" ? Number(v) : v)));
    return { columns, rows };
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
  }
}
