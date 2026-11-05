# China Study Abroad Agency CRM

A CRM for a Bangladesh-based agency that sends students to universities in China. It covers students and their documents, university offers and applications, tasks and sprints, the knowledge base (Info Center), finance, reports, an AI assistant and a student portal.

**Stack:** Next.js 14 (App Router, TypeScript strict) · Tailwind + shadcn/ui · Supabase (Postgres, Auth, Storage, RLS) · TanStack Table · react-hook-form + zod · Recharts · Anthropic API (Claude) · Playwright.

---

## 1. Prerequisites

- Node.js 20+ (tested on 22)
- A **Supabase** project (the free tier is fine). The Supabase CLI and Docker are *not* required.
- Optional: an **Anthropic API key** for the AI assistant

## 2. Configure

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | same page (server only, never exposed to the browser) |
| `DATABASE_URL` | Supabase → **Connect** → *Session pooler* URI (port 5432), with your DB password |
| `ANTHROPIC_API_KEY` | console.anthropic.com (optional; the assistant shows a "not configured" message without it) |
| `ANTHROPIC_MODEL` | defaults to `claude-opus-5-5` |

In Supabase → Authentication → URL Configuration, set **Site URL** to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to the redirect URLs, so password-reset emails work.

## 3. Install, migrate, seed, run

```bash
npm install
npm run db:migrate     # applies supabase/migrations/*.sql (idempotent; tracked in public._migrations)
npm run db:seed        # demo data: users, 15 universities, 20 offers, 40 students, 2 sprints/30 tasks, 6 months of finance
npm run dev            # http://localhost:3000
```

`npm run db:setup` runs migrate and seed together. `npm run db:migrate:all` force-re-applies every migration (all of them are re-runnable).

> ⚠️ `db:seed` **wipes business data** (students, offers, tasks, finance, knowledge base, audit log) before inserting the demo set. Roles, permissions and settings are kept.

## 4. Demo logins (created by the seed)

| Role | Email | Password |
|---|---|---|
| System Administrator | `sysadmin@crm.test` | `SysAdmin#2026` |
| Admin | `admin@crm.test` | `Admin#2026` |
| Operator | `operator@crm.test` | `Operator#2026` |
| Operator (2nd counselor) | `operator2@crm.test` | `Operator#2026` |
| Finance Operator | `finance@crm.test` | `Finance#2026` |
| Student (portal) | `student@crm.test` | `Student#2026` |

Change these passwords before using real data.

## 5. Tests

```bash
npx playwright install chromium   # first time only
npm run test:e2e                  # builds, starts on :3100, runs against your seeded Supabase project
npx tsx scripts/checks/sql-guard.check.ts   # AI SQL guard allow/block cases (no DB needed)
npx tsx scripts/checks/kb-exact.check.ts    # seeded visa checklist is byte-identical to the source
```

The e2e suite covers: login per role (menus), wrong password, HTTP 403 on restricted pages, enroll student, add task and change status, add offer and open the modal, add income and expense, and the AI assistant (count question, finance refusal for operators, verbatim checklist). The assistant tests are skipped when `ANTHROPIC_API_KEY` isn't set. The tests create records with an `E2E` prefix; re-run `npm run db:seed` to reset.

## 6. Project layout

```
app/                 routes (App Router)
  (auth)/            login, forgot/reset password
  (app)/             staff app: dashboard, tasks, students, offers, universities, kb, finance, reports,
                     assistant, import, audit, trash, settings, admin/users, admin/roles
  portal/            student portal
  api/               assistant + CSV/XLSX export endpoints
components/          ui (shadcn), shared (table, forms, uploads), feature components
lib/                 constants, permissions, nav, formatting, zod schemas (shared client/server)
server/              auth helpers, server actions, queries, AI (SQL guard, read-only runner)
supabase/migrations  versioned SQL: schema, triggers, RLS, storage, views, report functions, default data
supabase/seed        visa checklist (kept byte-exact)
scripts/             migrate, seed, checks
tests/e2e            Playwright
```

## 7. How permissions are enforced (three layers)

1. **UI.** Navigation and buttons are filtered on the server from `my_permissions()`, so items a role can't use are never sent to the browser.
2. **Server.** Middleware returns a real **HTTP 403** for restricted routes. Every server action and API route calls `assertPermission(module, action)`.
3. **Database.** RLS is on for every table, with policies built on `has_permission(module, action)`. Storage buckets are private, with matching policies, and files are served through 1-hour signed URLs. Report functions run with the caller's RLS and check permissions again.

The System Administrator edits the permission matrix at **Roles & permissions**.

## 8. AI assistant

`POST /api/assistant` calls Claude with two tools:
- `query_database`: Claude writes a SELECT. The server validates it (single statement, SELECT/WITH only, whitelisted views for the user's role, no dangerous functions, 200-row cap) and runs it as the Postgres role **`readonly_ai`** in a read-only transaction with a 5-second timeout.
- `search_knowledge_base`: Postgres full-text search over Info Center entries. Matching entries are shown **verbatim** in the UI.

Operators never get `v_finance`, so finance questions are refused. Students only see `v_my_*` views. Every query is logged in `ai_query_logs` (user, question, SQL, rows, time). Conversations are stored per user.

See [ASSUMPTIONS.md](ASSUMPTIONS.md) for design decisions.
