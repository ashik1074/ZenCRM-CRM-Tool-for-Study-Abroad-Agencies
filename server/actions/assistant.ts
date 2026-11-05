"use server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/server/auth";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta: { queries?: { sql: string; columns: string[]; rows: unknown[][]; rowCount: number; error?: string }[]; kb?: { id: string; title: string; body: string }[] };
  created_at: string;
};

export async function listConversations() {
  if (!(await getCurrentUser())) return [];
  const { data } = await createClient().from("ai_conversations").select("id, title, updated_at").is("deleted_at", null).order("updated_at", { ascending: false }).limit(50);
  return (data ?? []) as { id: string; title: string; updated_at: string }[];
}

export async function loadConversation(id: string): Promise<ChatMessage[]> {
  if (!(await getCurrentUser())) return [];
  const { data } = await createClient().from("ai_messages").select("id, role, content, meta, created_at").eq("conversation_id", id).order("created_at");
  return (data ?? []) as ChatMessage[];
}

export async function deleteConversation(id: string) {
  if (!(await getCurrentUser())) return;
  await createClient().from("ai_conversations").update({ deleted_at: new Date().toISOString() }).eq("id", id);
}
