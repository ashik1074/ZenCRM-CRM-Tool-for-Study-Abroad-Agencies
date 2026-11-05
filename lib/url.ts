import { PAGE_SIZE } from "./constants";

export type SearchParams = Record<string, string | string[] | undefined>;

export function sp(params: SearchParams, key: string): string | undefined {
  const v = params[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s === "" ? undefined : s;
}

/** Common list params: page (1-based), sort, dir, q */
export function listParams(params: SearchParams, defaults: { sort: string; dir?: "asc" | "desc" }) {
  const page = Math.max(1, Number(sp(params, "page") ?? 1) || 1);
  const size = Math.min(100, Math.max(5, Number(sp(params, "size") ?? PAGE_SIZE) || PAGE_SIZE));
  const sort = sp(params, "sort") ?? defaults.sort;
  const dir = (sp(params, "dir") ?? defaults.dir ?? "desc") === "asc" ? "asc" : "desc";
  const q = sp(params, "q")?.trim().slice(0, 100);
  return { page, size, sort, dir: dir as "asc" | "desc", q, from: (page - 1) * size, to: page * size - 1 };
}

/** Escape a user string for use inside a PostgREST `or=(...ilike...)` filter. */
export function ilikeTerm(q: string): string {
  return `%${q.replace(/[%_,()\\*]/g, " ").trim()}%`;
}
