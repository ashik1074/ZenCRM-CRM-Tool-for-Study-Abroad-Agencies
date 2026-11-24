/**
 * Removes ALL business data and every user account except the ones you keep, so the CRM starts empty.
 * Keeps setup data: roles, permissions, finance categories, exchange rates, settings.
 *
 *   npm run db:clear-demo -- --keep a@x.com,b@y.com             # dry run: shows what would be removed
 *   npm run db:clear-demo -- --keep a@x.com,b@y.com --confirm   # actually removes it (cannot be undone)
 *
 * Kept accounts become System Admins, so someone can still manage users and roles afterwards.
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL.
 */
import { config } from "dotenv";
import { Client } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

/** Every table holding records users create. Listed explicitly (no CASCADE) so a new FK can't silently widen the wipe. */
const BUSINESS_TABLES = [
  "ai_messages", "ai_conversations", "ai_query_logs", "notifications",
  "transactions", "fee_installments", "fee_plans",
  "task_activity", "task_comments", "task_attachments", "tasks", "sprints",
  "applications", "offer_attachments", "offers", "universities",
  "student_notes", "student_documents", "student_status_history", "student_travel_history",
  "student_family_members", "student_work_experience", "student_education", "students",
  "kb_attachments", "kb_entries",
  "audit_logs", // last: deleting users above writes audit rows
];
const BUCKETS = ["student-files", "offer-leaflets", "task-attachments", "receipts", "kb-attachments"];
const SEQUENCES = ["student_code_seq", "receipt_no_seq"]; // ST-1001, receipt 10001 start again

function arg(name: string) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** All object paths in a bucket (folders are listed recursively). */
async function listFiles(admin: SupabaseClient, bucket: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`List ${bucket}/${prefix}: ${error.message}`);
    for (const e of data ?? []) {
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id === null) out.push(...(await listFiles(admin, bucket, path))); // folder
      else out.push(path);
    }
    if (!data || data.length < 1000) return out;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DATABASE_URL;
  if (!url || !service || !dbUrl) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL in .env.local");
  const keep = (arg("--keep") ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!keep.length) throw new Error("Pass --keep with the account email(s) to keep, e.g. --keep you@agency.com");
  const confirm = process.argv.includes("--confirm");

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const db = new Client({ connectionString: dbUrl, ssl: dbUrl.includes("localhost") ? false : { rejectUnauthorized: false } });
  await db.connect();
  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as T[];

  try {
    // ---------- preflight ----------
    const profiles = await q<{ id: string; email: string; role: string }>(
      `select p.id, lower(p.email) as email, r.key as role from public.profiles p join public.roles r on r.id = p.role_id order by p.email`,
    );
    const missing = keep.filter((e) => !profiles.some((p) => p.email === e));
    if (missing.length) throw new Error(`These accounts to keep don't exist: ${missing.join(", ")}. Nothing was changed.`);
    const [sysRole] = await q<{ id: string }>(`select id from public.roles where key = 'system_admin'`);
    if (!sysRole) throw new Error("system_admin role not found. Nothing was changed.");

    const { data: authList, error: authErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (authErr) throw authErr;
    const keepIds = new Set(profiles.filter((p) => keep.includes(p.email)).map((p) => p.id));
    const removeUsers = authList.users.filter((u) => !keepIds.has(u.id));

    const counts: [string, number][] = [];
    for (const t of BUSINESS_TABLES) counts.push([t, (await q<{ n: number }>(`select count(*)::int as n from public."${t}"`))[0].n]);
    const files: Record<string, string[]> = {};
    for (const b of BUCKETS) files[b] = await listFiles(admin, b);

    console.log(`\nDatabase: ${new URL(url).host}`);
    console.log(`\nAccounts kept (made System Admin): ${keep.join(", ")}`);
    console.log(`Accounts removed (${removeUsers.length}): ${removeUsers.map((u) => u.email ?? u.id).join(", ") || "none"}`);
    console.log(`\nRecords removed:`);
    for (const [t, n] of counts) if (n) console.log(`  ${t.padEnd(26)} ${n}`);
    console.log(`  ${"TOTAL".padEnd(26)} ${counts.reduce((s, [, n]) => s + n, 0)}`);
    console.log(`\nFiles removed:`);
    for (const b of BUCKETS) if (files[b].length) console.log(`  ${b.padEnd(26)} ${files[b].length}`);
    console.log(`\nKept: roles, permissions, finance categories, exchange rates, settings.`);

    if (!confirm) {
      console.log(`\nDRY RUN — nothing was changed. Re-run with --confirm to delete permanently.\n`);
      return;
    }

    // ---------- 1. keep accounts: System Admin, active ----------
    console.log(`\n• Promoting kept accounts to System Admin`);
    await q(`update public.profiles set role_id = $1, is_active = true, deleted_at = null where id = any($2::uuid[])`, [sysRole.id, [...keepIds]]);
    for (const id of keepIds) await admin.auth.admin.updateUserById(id, { ban_duration: "none" });

    // ---------- 2. files ----------
    console.log(`• Removing files`);
    for (const b of BUCKETS) {
      for (let i = 0; i < files[b].length; i += 100) {
        const { error } = await admin.storage.from(b).remove(files[b].slice(i, i + 100));
        if (error) throw new Error(`Remove files from ${b}: ${error.message}`);
      }
    }

    // ---------- 3. business data, in one transaction ----------
    // Before deleting accounts: otherwise nulling a task's assignee fires log_task_activity(), which records
    // the deleted user as the actor and fails its foreign key.
    console.log(`• Removing records`);
    await q("begin");
    await q(`truncate ${BUSINESS_TABLES.map((t) => `public."${t}"`).join(", ")} restart identity`);
    for (const s of SEQUENCES) await q(`alter sequence public."${s}" restart`);
    await q("commit");

    // ---------- 4. accounts (profile rows cascade; references in setup tables become null) ----------
    console.log(`• Removing ${removeUsers.length} account(s)`);
    for (const u of removeUsers) {
      const { error } = await admin.auth.admin.deleteUser(u.id);
      if (error) throw new Error(`Delete account ${u.email}: ${error.message}`);
    }
    // account deletion writes audit rows / notifications; clear them so those lists stay empty too
    await q(`truncate public.audit_logs, public.notifications restart identity`);

    // ---------- verify ----------
    const left: string[] = [];
    for (const t of BUSINESS_TABLES) {
      const n = (await q<{ n: number }>(`select count(*)::int as n from public."${t}"`))[0].n;
      if (n) left.push(`${t}=${n}`);
    }
    const users = await q<{ email: string; role: string }>(`select p.email, r.key as role from public.profiles p join public.roles r on r.id = p.role_id`);
    console.log(`\nDone. Remaining accounts: ${users.map((u) => `${u.email} (${u.role})`).join(", ")}`);
    console.log(left.length ? `Rows still present (written after the wipe): ${left.join(", ")}` : `All lists are empty.`);
  } catch (e) {
    await q("rollback").catch(() => {});
    throw e;
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(`\n✗ ${(e as Error).message}`);
  process.exit(1);
});
