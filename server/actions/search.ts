"use server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/server/auth";

export type SearchHit = { kind: "student" | "offer" | "university" | "task" | "kb"; id: string; title: string; subtitle: string | null; link: string };

/** Global search. The SQL function checks permissions per entity type and runs under RLS. */
export async function globalSearch(q: string): Promise<SearchHit[]> {
  if (!(await getCurrentUser())) return [];
  const term = q.trim().slice(0, 100);
  if (term.length < 2) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("global_search", { p_q: term });
  if (error) return [];
  return (data ?? []) as SearchHit[];
}
