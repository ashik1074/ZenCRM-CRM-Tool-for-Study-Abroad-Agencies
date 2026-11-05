import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { todayDhaka } from "@/lib/format";
import { allowedViews, canUseKb, schemaDoc } from "@/server/ai/views";
import { guardSql } from "@/server/ai/sql-guard";
import { runReadOnly } from "@/server/ai/run-query";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 6;

// --- simple per-user rate limit (in-memory; per server instance) ---
const hits = new Map<string, number[]>();
function rateLimited(userId: string, limit = 15, windowMs = 60_000) {
  const now = Date.now();
  const list = (hits.get(userId) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(userId, list);
  return list.length > limit;
}

const bodySchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1, "Ask a question").max(2000),
});

export type QueryMeta = { sql: string; columns: string[]; rows: unknown[][]; rowCount: number; error?: string };
export type KbMeta = { id: string; title: string; body: string };

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (!can(user.permissions, "assistant", "view")) return NextResponse.json({ error: "Your role doesn't have access to the AI assistant." }, { status: 403 });
  if (rateLimited(user.id)) return NextResponse.json({ error: "You're asking too quickly. Please wait a minute and try again." }, { status: 429 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "The AI assistant isn't configured yet (ANTHROPIC_API_KEY is missing on the server)." }, { status: 503 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { message } = parsed.data;
  const supabase = createClient();

  // conversation (RLS: own conversations only)
  let conversationId = parsed.data.conversationId;
  if (conversationId) {
    const { data } = await supabase.from("ai_conversations").select("id").eq("id", conversationId).maybeSingle();
    if (!data) conversationId = undefined;
  }
  if (!conversationId) {
    const { data, error } = await supabase.from("ai_conversations").insert({ user_id: user.id, title: message.slice(0, 80) }).select("id").single();
    if (error) return NextResponse.json({ error: "Could not start a conversation." }, { status: 500 });
    conversationId = data.id as string;
  }
  const { data: history } = await supabase.from("ai_messages").select("role, content").eq("conversation_id", conversationId).order("created_at").limit(20);
  await supabase.from("ai_messages").insert({ conversation_id: conversationId, role: "user", content: message });

  const views = allowedViews(user);
  const kbAllowed = canUseKb(user);
  const tools: Anthropic.Beta.BetaTool[] = [];
  if (views.length)
    tools.push({
      name: "query_database",
      description:
        "Run ONE read-only PostgreSQL SELECT (or WITH … SELECT) against the agency's reporting views listed in the system prompt. Only those views exist for you. Results are capped at 200 rows. Use aggregate queries (count, sum) for totals.",
      strict: true,
      input_schema: {
        type: "object",
        properties: { sql: { type: "string", description: "A single SELECT statement. No semicolons, no comments." } },
        required: ["sql"],
        additionalProperties: false,
      },
    });
  if (kbAllowed)
    tools.push({
      name: "search_knowledge_base",
      description: "Full-text search the agency knowledge base (checklists, templates, SOPs, FAQs, university notes). Returns matching entries with their full text.",
      strict: true,
      input_schema: {
        type: "object",
        properties: { query: { type: "string", description: "Search words, e.g. 'visa interview checklist'" } },
        required: ["query"],
        additionalProperties: false,
      },
    });

  const system = `You are the data assistant inside a CRM for a Bangladesh-based agency that sends students to universities in China.
Today's date in Asia/Dhaka is ${todayDhaka()}. The user is ${user.full_name} (role: ${user.role_name}).

How to answer:
- Answer only from tool results. Never guess or estimate numbers. If the data needed isn't in the views you have, or a query fails, say plainly that you can't answer it from the available data.
- If the question needs data you have no view for (for example finance data when no finance view is listed), say that their role doesn't have access to that information. Do not attempt it another way.
- Keep answers short: one or two sentences with the key figure. The app shows result tables and the SQL to the user automatically — don't repeat tables in prose or paste SQL.
- Dates: "this year" = calendar year of today's date; "last month" = the previous calendar month. Use the *_date columns.
- For knowledge-base questions, call search_knowledge_base. The app displays the matching entry's text verbatim below your answer, so do NOT rewrite, summarize or reformat it — just say which entry it is in one line.
- Plain text only, no markdown headings.

${views.length ? `Reporting views you can query (PostgreSQL):\n\n${schemaDoc(views)}` : "You have no database views available."}`;

  const priorMessages: Anthropic.Beta.BetaMessageParam[] = (history ?? [])
    .filter((m: { role: string; content: string }) => m.content)
    .map((m: { role: string; content: string }) => ({ role: m.role as "user" | "assistant", content: m.content }));
  const messages: Anthropic.Beta.BetaMessageParam[] = [...priorMessages, { role: "user", content: message }];

  const client = new Anthropic();
  const queries: QueryMeta[] = [];
  const kb: KbMeta[] = [];
  let answer = "";

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        tools,
        tool_choice: { type: "auto" },
        messages,
      });

      if (response.stop_reason === "refusal") {
        answer = "I can't help with that request.";
        break;
      }
      // keep the full assistant content (incl. thinking blocks) unchanged for the next round
      messages.push({ role: "assistant", content: response.content });
      const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (response.stop_reason !== "tool_use" || !toolUses.length || round === MAX_TOOL_ROUNDS) {
        answer = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
        if (!answer && round === MAX_TOOL_ROUNDS) answer = "I couldn't finish answering that from the data. Please try rephrasing the question.";
        break;
      }

      const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(
        toolUses.map(async (tu): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
          const input = tu.input as Record<string, unknown>;
          const started = Date.now();
          if (tu.name === "query_database" && views.length && typeof input.sql === "string") {
            const guard = guardSql(input.sql, views);
            if (!guard.ok) {
              await logQuery(supabase, user.id, conversationId!, message, "query_database", input.sql, null, Date.now() - started, guard.error);
              queries.push({ sql: input.sql, columns: [], rows: [], rowCount: 0, error: guard.error });
              return { type: "tool_result", tool_use_id: tu.id, is_error: true, content: guard.error };
            }
            try {
              const r = await runReadOnly(guard.sql, user.id);
              await logQuery(supabase, user.id, conversationId!, message, "query_database", input.sql, r.rows.length, Date.now() - started, null);
              queries.push({ sql: input.sql, columns: r.columns, rows: r.rows, rowCount: r.rows.length });
              return { type: "tool_result", tool_use_id: tu.id, content: JSON.stringify({ columns: r.columns, rows: r.rows, row_count: r.rows.length, truncated: r.rows.length >= 200 }) };
            } catch (e) {
              const err = (e as Error).message.slice(0, 300);
              await logQuery(supabase, user.id, conversationId!, message, "query_database", input.sql, null, Date.now() - started, err);
              queries.push({ sql: input.sql, columns: [], rows: [], rowCount: 0, error: err });
              return { type: "tool_result", tool_use_id: tu.id, is_error: true, content: `Query failed: ${err}` };
            }
          }
          if (tu.name === "search_knowledge_base" && kbAllowed && typeof input.query === "string") {
            const entries = await searchKb(supabase, input.query);
            await logQuery(supabase, user.id, conversationId!, message, "search_knowledge_base", input.query, entries.length, Date.now() - started, null);
            for (const e of entries.slice(0, 1)) if (!kb.some((k) => k.id === e.id)) kb.push(e);
            return { type: "tool_result", tool_use_id: tu.id, content: entries.length ? JSON.stringify(entries) : "No matching knowledge base entries." };
          }
          return { type: "tool_result", tool_use_id: tu.id, is_error: true, content: "This tool is not available for your role." };
        }),
      );
      messages.push({ role: "user", content: results });
    }
  } catch (e) {
    const msg =
      e instanceof Anthropic.RateLimitError ? "The AI service is busy. Please try again in a moment." :
      e instanceof Anthropic.AuthenticationError ? "The AI service key is invalid. Ask an administrator to check ANTHROPIC_API_KEY." :
      e instanceof Anthropic.APIError ? `The AI service returned an error (${e.status}).` : "Something went wrong while answering.";
    console.error("[assistant]", e);
    await logQuery(supabase, user.id, conversationId, message, null, null, null, 0, (e as Error).message?.slice(0, 300) ?? "error");
    return NextResponse.json({ error: msg, conversationId }, { status: 502 });
  }

  const meta = { queries, kb };
  await supabase.from("ai_messages").insert({ conversation_id: conversationId, role: "assistant", content: answer || "(no answer)", meta });
  await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
  return NextResponse.json({ conversationId, answer, ...meta });
}

async function searchKb(supabase: ReturnType<typeof createClient>, q: string): Promise<KbMeta[]> {
  const words = q.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter((w) => w.length > 1).slice(0, 8);
  if (!words.length) return [];
  // match all words first, then fall back to any word
  for (const op of [" & ", " | "]) {
    const { data } = await supabase
      .from("kb_entries")
      .select("id, title, body_text")
      .is("deleted_at", null)
      .textSearch("search", words.map((w) => `${w}:*`).join(op), { config: "simple" })
      .limit(3);
    if (data?.length) return data.map((d: { id: string; title: string; body_text: string }) => ({ id: d.id, title: d.title, body: d.body_text }));
  }
  return [];
}

async function logQuery(
  supabase: ReturnType<typeof createClient>, userId: string, conversationId: string, question: string,
  tool: string | null, sql: string | null, rowCount: number | null, ms: number, error: string | null,
) {
  await supabase.from("ai_query_logs").insert({ user_id: userId, conversation_id: conversationId, question, tool, sql, row_count: rowCount, duration_ms: ms, error });
}
