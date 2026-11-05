# Assumptions & decisions

Where the brief was ambiguous, the most practical option for a small agency team was chosen. Each item notes what was decided and why.

## Platform
- **Hosted Supabase, no Supabase CLI or Docker.** Migrations are plain idempotent SQL applied by `scripts/migrate.ts` over `DATABASE_URL`. Re-running is safe (`npm run db:migrate:all`).
- **Generated types.** The Supabase type generator needs the CLI. Domain types live next to the queries, and every query runs under RLS, so the database stays the source of truth. If you install the CLI later: `npx supabase gen types typescript --db-url "$DATABASE_URL" > lib/database.types.ts`.
- **Scheduled notifications** (task due tomorrow, passport expiring, installment overdue) come from `generate_scheduled_notifications()`. If `pg_cron` is enabled in the project, it runs hourly. Otherwise the app runs it at most every 10 minutes when anyone loads notifications. The SQL dedupes, so nobody gets the same notification twice.

## Roles & permissions
- **Users and Roles are always System-Administrator-only.** These modules appear locked in the permission matrix and `has_permission()` refuses them for any other role, even if someone inserts a grant directly.
- Extra permission modules beyond the brief: `tasks_all` (see and edit other people's tasks), `sprints`, `finance_categories`, `finance_reports`, `assistant_finance`, `trash` (see and restore deleted items), `import`, `portal`.
- "Own tasks" means tasks you are assigned to, reported, or created. **My tasks** filters by assignee.
- Operators get `tasks_all:view` so they can coordinate. Finance Operators only see their own tasks.
- There is **one counselor field per student**. Every role with `students:view` sees all students; nothing restricts a counselor to their own students.

## Students
- **Drafts** need only the full name. Finishing enrollment also needs phone, gender and date of birth.
- **Edit** opens from the student details page (`/students/[id]/edit`). Every change is audited at field level.
- **Duplicate detection** warns but doesn't block, because siblings can share a phone number. Phone numbers are compared digits-only. Email is case-insensitive. Passport numbers are uppercased.
- **Notes & Activity** uses a small extra table, `student_notes`, for timestamped notes. The activity feed merges status history with the audit log.
- **Checklist tracker:** the required documents are a Setting. A document is "expired" when its own expiry date has passed, or, for Passport, when the student's passport expiry has passed.
- **Visa info sheet:** the Info Center template is filled line by line by matching labels, so its wording and line structure never change. Values are only appended. Dates use `YYYY/MM/DD`, as the label says. The most recent job fills the work block. Education is HSC and above, in order, filling the three school blocks. If the student has no previous China visa or residence, "Sent all … Copy" becomes "No".

## Tasks
- Besides the **Active** section and the collapsible **Inactive** section, there's a **Backlog & planned sprints** section. It holds open tasks with no sprint or in a planned sprint, so they don't disappear.
- Completing a sprint can move its unfinished tasks to a planned sprint.

## Offers & applications
- Offers default to **Open** in the list; the status filter can show any status. Expiry runs from a trigger on write, plus a batch function on list load and on schedule.
- Applying a student to an offer moves early-stage students to *Applied*. Accepting an application moves them to *Offer Received*. Later stages (JW202, visa, departure) are set manually.
- "Offers received this month" on the dashboard counts accepted applications decided this month.

## Reports
- Report periods use Asia/Dhaka dates. **Visa outcomes** use each student's latest visa decision in the period, attributed to their most recently accepted application's university and program.
- **Conversion** (counselor and lead-source reports) means the student reached Visa Approved, Departed or Enrolled.
- Charts use a validated colour-blind-safe categorical palette with separate light and dark steps. Every chart has a data table and export.

## Finance
- Amounts are `numeric(14,2)` plus a currency and the exchange rate used. `amount_bdt` is a generated column, and all totals use it.
- **Fee plan installments** must add up to the package total. A payment linked to an installment updates its `paid_amount` through a trigger, converted to the plan's currency.
- Money receipt numbers (`MR-…`) are assigned automatically to income that is linked to a student.
- `report_finance()` is `SECURITY DEFINER`, behind an explicit `finance:view` or `finance_reports:view` check. A role can therefore have finance reports without row access to individual transactions.
- Users with `finance:view` see the student Payments tab. Other staff see a notice instead.

## AI assistant
- Default model: `claude-opus-5-5` with adaptive thinking at effort `medium`. Change it with `ANTHROPIC_MODEL`. Server-side refusal fallbacks (`fallbacks: "default"`) are on.
- Role scoping happens on the server. Each role gets a whitelist of views (`server/ai/views.ts`). The SQL guard rejects any other table, as well as multiple statements, comments, DML/DDL and session-changing functions. A guarded query runs as `readonly_ai` in a read-only transaction with a 5-second timeout, capped at 200 rows.
- Students only get `v_my_*` views, scoped by a transaction-local `app.user_id`. The default Student role has no assistant permission, but this works if a System Admin grants it.
- **Knowledge-base answers are shown verbatim.** The UI renders the matched entry's stored text directly under the model's one-line answer, so the checklist can't be reworded.
- The rate limit is 15 questions per minute per user, held in memory per server instance. Use Redis or similar if you scale out.
- History is stored per user. Every tool call is logged in `ai_query_logs` with the question, SQL, row count, duration and any error.

## Misc
- Pagination is server-side, 20 per page, on every list except **Users** (the staff list is small, so it pages in the browser) and the student Tasks tab (up to 100 rows).
- Soft-deleted records (students, offers, tasks, transactions) are hidden everywhere and only visible on **Deleted items** (`trash:view`). Admins restore them there.
- The agency logo is stored in the `kb-attachments` bucket under `branding/`.
- The session timeout is client-side inactivity (default 60 minutes), shared across tabs. Supabase refresh tokens still expire as configured in your project.
