import "server-only";
import { Parser } from "node-sql-parser";

const parser = new Parser();
export const MAX_ROWS = 200;

// Functions/keywords that could escape the sandbox or change session state.
const FORBIDDEN = /\b(set_config|current_setting|pg_[a-z_]+|dblink\w*|lo_\w+|copy|query_to_xml\w*|xpath|txid_\w+|nextval|setval|currval|into|for\s+update|for\s+share|pg_sleep)\b/i;

export type GuardResult = { ok: true; sql: string } | { ok: false; error: string };

/**
 * Validates an AI-written query: one statement, SELECT/WITH only, only the allowed views
 * (CTE names permitted), no dangerous functions; wraps it to enforce a row limit.
 */
export function guardSql(raw: string, allowed: string[]): GuardResult {
  const sql = raw.trim().replace(/;+\s*$/, "");
  if (!sql) return { ok: false, error: "Empty query." };
  if (sql.includes(";")) return { ok: false, error: "Only a single statement is allowed." };
  if (/--|\/\*/.test(sql)) return { ok: false, error: "Comments are not allowed in queries." };
  if (!/^\s*(select|with)\b/i.test(sql)) return { ok: false, error: "Only SELECT queries are allowed." };
  if (FORBIDDEN.test(sql)) return { ok: false, error: "The query uses a function or clause that isn't allowed." };

  let ast;
  try {
    ast = parser.astify(sql, { database: "PostgresQL" });
  } catch (e) {
    return { ok: false, error: `Could not parse SQL: ${(e as Error).message.slice(0, 200)}` };
  }
  const stmts = Array.isArray(ast) ? ast : [ast];
  if (stmts.length !== 1 || (stmts[0] as { type?: string }).type !== "select") return { ok: false, error: "Only a single SELECT statement is allowed." };

  // CTE names defined in the query are fine to reference
  const ctes = new Set<string>();
  const collect = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { with?: { name?: { value?: string } | string }[] };
    for (const w of n.with ?? []) {
      const name = typeof w.name === "string" ? w.name : w.name?.value;
      if (name) ctes.add(name.toLowerCase());
    }
  };
  collect(stmts[0]);

  let tables: string[];
  try {
    tables = parser.tableList(sql, { database: "PostgresQL" });
  } catch {
    return { ok: false, error: "Could not determine which tables the query reads." };
  }
  const allowedSet = new Set(allowed.map((v) => v.toLowerCase()));
  for (const t of tables) {
    // format: "select::schema::table"
    const [, schema, table] = t.split("::");
    const name = table.toLowerCase();
    if (ctes.has(name)) continue;
    if ((schema && schema !== "null" && schema.toLowerCase() !== "public") || !allowedSet.has(name)) {
      return { ok: false, error: `Access to "${table}" is not allowed. Allowed views: ${allowed.join(", ") || "none"}.` };
    }
  }
  if (!tables.length) return { ok: false, error: "The query must read from at least one allowed view." };

  return { ok: true, sql: `select * from (\n${sql}\n) as ai_q limit ${MAX_ROWS}` };
}
