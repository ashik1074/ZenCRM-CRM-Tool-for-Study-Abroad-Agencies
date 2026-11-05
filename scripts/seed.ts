/**
 * Seeds demo data. Re-runnable: wipes business data (not roles/permissions/settings) and reinserts.
 *   npm run db:seed
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL.
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

export const SEED_USERS = [
  { email: "sysadmin@crm.test", password: "SysAdmin#2026", name: "Sadia Rahman", role: "system_admin", phone: "+8801711000001" },
  { email: "admin@crm.test", password: "Admin#2026", name: "Tanvir Hasan", role: "admin", phone: "+8801711000002" },
  { email: "operator@crm.test", password: "Operator#2026", name: "Nusrat Jahan", role: "operator", phone: "+8801711000003" },
  { email: "operator2@crm.test", password: "Operator#2026", name: "Arif Hossain", role: "operator", phone: "+8801711000006" },
  { email: "finance@crm.test", password: "Finance#2026", name: "Kamal Uddin", role: "finance_operator", phone: "+8801711000004" },
  { email: "student@crm.test", password: "Student#2026", name: "Rafiul Islam", role: "student", phone: "+8801812345678" },
] as const;

// ---------- deterministic random ----------
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rand() * a.length)];
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const TODAY = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));

const UNIVERSITIES = [
  ["Zhejiang University", "Hangzhou", "Zhejiang", 3],
  ["Fudan University", "Shanghai", "Shanghai", 4],
  ["Wuhan University", "Wuhan", "Hubei", 9],
  ["Nanjing University", "Nanjing", "Jiangsu", 6],
  ["Sichuan University", "Chengdu", "Sichuan", 12],
  ["Shandong University", "Jinan", "Shandong", 15],
  ["Jilin University", "Changchun", "Jilin", 17],
  ["Southeast University", "Nanjing", "Jiangsu", 14],
  ["Chongqing University", "Chongqing", "Chongqing", 30],
  ["Dalian University of Technology", "Dalian", "Liaoning", 28],
  ["Northeast Forestry University", "Harbin", "Heilongjiang", 110],
  ["China Three Gorges University", "Yichang", "Hubei", 160],
  ["Jiangsu University", "Zhenjiang", "Jiangsu", 70],
  ["Hohai University", "Nanjing", "Jiangsu", 60],
  ["Zhengzhou University", "Zhengzhou", "Henan", 40],
] as const;

const PROGRAMS = [
  ["Computer Science and Technology", "Bachelor"], ["Software Engineering", "Master"], ["MBBS", "Bachelor"],
  ["Civil Engineering", "Bachelor"], ["International Business", "Master"], ["Electrical Engineering", "Master"],
  ["Chinese Language", "Language"], ["Mechanical Engineering", "Bachelor"], ["Public Health", "Master"],
  ["Environmental Science", "PhD"], ["Economics", "Bachelor"], ["Water Resources Engineering", "PhD"],
] as const;

const STATUSES = ["inquiry", "registered", "documents_collecting", "applied", "offer_received", "jw202_received",
  "visa_applied", "visa_approved", "visa_rejected", "departed", "enrolled", "dropped", "on_hold"] as const;
const PATH = ["inquiry", "registered", "documents_collecting", "applied", "offer_received", "jw202_received", "visa_applied", "visa_approved", "departed", "enrolled"];

const FIRST_M = ["Rahim", "Karim", "Sakib", "Tamim", "Mehedi", "Arafat", "Imran", "Fahim", "Rakib", "Shuvo", "Nayeem", "Jubayer", "Mahmud", "Tanjim", "Rifat", "Sabbir", "Hasib", "Ashraful", "Zahid", "Mamun"];
const FIRST_F = ["Ayesha", "Fatema", "Nusrat", "Tasnim", "Sumaiya", "Mim", "Jannatul", "Farzana", "Sharmin", "Lamia", "Nafisa", "Rumana", "Tahmina", "Sadia", "Maliha"];
const LAST = ["Rahman", "Hossain", "Islam", "Ahmed", "Chowdhury", "Uddin", "Akter", "Khan", "Sarkar", "Talukder", "Mia", "Haque", "Siddique", "Bhuiyan", "Kabir"];
const DISTRICTS = ["Dhaka", "Chattogram", "Sylhet", "Rajshahi", "Khulna", "Barishal", "Rangpur", "Mymensingh", "Cumilla", "Gazipur"];
const SOURCES = ["Facebook", "Referral", "Walk-in", "Website", "Agent"];
const INTAKES = ["March 2026", "September 2026", "March 2027", "September 2027"];
const SCHOLARSHIPS = ["CSC", "Provincial", "University", "Self-funded"] as const;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DATABASE_URL;
  if (!url || !service || !dbUrl) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL in .env.local");

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const db = new Client({ connectionString: dbUrl, ssl: dbUrl.includes("localhost") ? false : { rejectUnauthorized: false } });
  await db.connect();
  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as T[];

  console.log("• Wiping demo data");
  await q(`truncate public.ai_messages, public.ai_conversations, public.ai_query_logs, public.notifications,
    public.transactions, public.fee_installments, public.fee_plans, public.task_activity, public.task_comments,
    public.task_attachments, public.tasks, public.sprints, public.applications, public.offer_attachments, public.offers,
    public.universities, public.student_documents, public.student_status_history, public.student_travel_history,
    public.student_family_members, public.student_work_experience, public.student_education, public.students,
    public.kb_attachments, public.kb_entries, public.audit_logs restart identity cascade`);

  // ---------- users ----------
  console.log("• Users");
  const roles = Object.fromEntries((await q<{ key: string; id: string }>("select key, id from public.roles")).map((r) => [r.key, r.id]));
  const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const ids: Record<string, string> = {};
  for (const u of SEED_USERS) {
    let id = existing?.users.find((x) => x.email === u.email)?.id;
    if (!id) {
      const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true, user_metadata: { full_name: u.name } });
      if (error) throw error;
      id = data.user.id;
    } else {
      await admin.auth.admin.updateUserById(id, { password: u.password, ban_duration: "none" });
    }
    ids[u.email] = id;
    await q(`insert into public.profiles (id, role_id, full_name, email, phone, is_active)
             values ($1,$2,$3,$4,$5,true)
             on conflict (id) do update set role_id = excluded.role_id, full_name = excluded.full_name, is_active = true, deleted_at = null`,
      [id, roles[u.role], u.name, u.email, u.phone]);
  }
  const adm = ids["admin@crm.test"], op = ids["operator@crm.test"], op2 = ids["operator2@crm.test"], fin = ids["finance@crm.test"];
  const counselors = [op, op2, adm];


  // ---------- universities ----------
  console.log("• Universities");
  const uniIds: string[] = [];
  for (const [name, city, province, ranking] of UNIVERSITIES) {
    const slug = name.toLowerCase().replace(/[^a-z]+/g, "");
    const [r] = await q<{ id: string }>(`insert into public.universities (name, city, province, ranking, website, contact_person, email, notes, created_by)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [name, city, province, ranking, `https://www.${slug}.edu.cn`, "International Office", `admission@${slug}.edu.cn`, `Partner since ${int(2018, 2024)}.`, adm]);
    uniIds.push(r.id);
  }

  // ---------- offers ----------
  console.log("• Offers");
  const offerIds: { id: string; uni: string; program: string }[] = [];
  for (let i = 0; i < 20; i++) {
    const uni = uniIds[i % uniIds.length];
    const [program, level] = PROGRAMS[i % PROGRAMS.length];
    const sch = pick(SCHOLARSHIPS);
    const full = sch === "CSC";
    // a few expired, a few closed, most open
    const deadline = i < 3 ? addDays(TODAY, -int(5, 60)) : addDays(TODAY, int(10, 180));
    const status = i === 3 ? "closed" : "open";
    const [r] = await q<{ id: string }>(`insert into public.offers (title, university_id, program, degree_level, intake, scholarship_type,
      covers_tuition, covers_accommodation, stipend_amount, tuition_fee, accommodation_fee, application_deadline,
      language_of_instruction, eligibility, source, partner_name, status, created_by, created_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) returning id`,
      [`${sch} ${level} – ${program}`, uni, program, level, pick(INTAKES), sch, full || sch === "Provincial", full,
        full ? (level === "PhD" ? 3500 : level === "Master" ? 3000 : 2500) : sch === "University" ? 1000 : null,
        [18000, 22000, 26000, 30000, 45000][int(0, 4)], [6000, 8000, 9600][int(0, 2)], iso(deadline),
        pick(["English", "Chinese", "Bilingual"]), "HSC GPA ≥ 4.0 (Bachelor) / CGPA ≥ 3.0 (Master). Age under 30. IELTS 6.0 or HSK 4.",
        i % 4 === 0 ? "partner_agent" : "direct", i % 4 === 0 ? "Beijing EduLink Partners" : null, status, op,
        addDays(TODAY, -int(5, 170)).toISOString()]);
    offerIds.push({ id: r.id, uni, program });
  }

  // ---------- students ----------
  console.log("• Students");
  const studentIds: { id: string; status: string; counselor: string; created: Date }[] = [];
  for (let i = 0; i < 40; i++) {
    const female = rand() < 0.4;
    const name = `${pick(female ? FIRST_F : FIRST_M)} ${pick(LAST)}`;
    const status = i < 39 ? STATUSES[i % STATUSES.length] : "registered";
    const created = i % 10 === 1 ? addDays(TODAY, -int(0, Math.max(0, TODAY.getDate() - 1))) : addDays(TODAY, -int(5, 330));
    const counselor = pick(counselors);
    const district = pick(DISTRICTS);
    const expiry = i % 7 === 0 ? addDays(TODAY, int(20, 170)) : addDays(TODAY, int(400, 3000));
    const isPortalStudent = i === 4;
    const fullName = isPortalStudent ? "Rafiul Islam" : name;
    const level = pick(["Bachelor", "Master", "Bachelor", "Language", "PhD"] as const);
    const [r] = await q<{ id: string }>(`insert into public.students (user_id, full_name, gender, date_of_birth, phone, whatsapp, email,
      present_address, permanent_address, passport_no, passport_issue_date, passport_expiry_date, hsk_level, ielts_score,
      intended_program_level, preferred_majors, preferred_cities, intake, scholarship_type, has_valid_foreign_visa,
      visited_countries_past_12m, previous_china_visa, previous_china_residence, lead_source, referred_by, counselor_id,
      status, created_by, created_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29) returning id`,
      [isPortalStudent ? ids["student@crm.test"] : null, fullName, female ? "female" : "male",
        iso(new Date(int(1996, 2006), int(0, 11), int(1, 28))),
        isPortalStudent ? "+8801812345678" : `+88017${String(10000000 + i * 7919).slice(0, 8)}`,
        isPortalStudent ? "+8801812345678" : `+88019${String(20000000 + i * 6007).slice(0, 8)}`,
        isPortalStudent ? "student@crm.test" : `${fullName.toLowerCase().replace(/\s/g, ".")}${i}@gmail.com`,
        `House ${int(1, 99)}, Road ${int(1, 30)}, ${district}`, `Village ${pick(["Char", "Bil", "Nodi"])}para, ${district}`,
        `A${String(10000000 + i * 104729).slice(0, 8)}`, iso(addDays(expiry, -3650)), iso(expiry),
        rand() < 0.3 ? `HSK ${int(2, 5)}` : null, rand() < 0.6 ? [5.5, 6, 6.5, 7][int(0, 3)] : null, level,
        [pick(PROGRAMS)[0]], [pick(UNIVERSITIES)[1]], pick(INTAKES), pick(SCHOLARSHIPS), rand() < 0.2, rand() < 0.3,
        rand() < 0.1, rand() < 0.05, pick(SOURCES), rand() < 0.3 ? `${pick(FIRST_M)} ${pick(LAST)}` : null, counselor,
        status, counselor, created.toISOString()]);
    const sid = r.id;
    studentIds.push({ id: sid, status, counselor, created });

    // synthetic status history walking the pipeline
    await q("delete from public.student_status_history where student_id = $1", [sid]);
    let steps: string[];
    if (status === "visa_rejected") steps = [...PATH.slice(0, 7), "visa_rejected"];
    else if (status === "dropped" || status === "on_hold") steps = [...PATH.slice(0, int(2, 4)), status];
    else steps = PATH.slice(0, PATH.indexOf(status) + 1);
    const span = Math.max(1, Math.floor((TODAY.getTime() - created.getTime()) / 86400000));
    let prev: string | null = null;
    for (let s = 0; s < steps.length; s++) {
      const at = addDays(created, Math.floor((span * s) / Math.max(steps.length, 1)));
      await q(`insert into public.student_status_history (student_id, from_status, to_status, changed_by, changed_at) values ($1,$2,$3,$4,$5)`,
        [sid, prev, steps[s], counselor, at.toISOString()]);
      prev = steps[s];
    }

    // education
    await q(`insert into public.student_education (student_id, level, institution, degree, major, passing_year, gpa, sort_order) values
      ($1,'SSC',$2,'SSC','Science',$3,'5.00',0), ($1,'HSC',$4,'HSC','Science',$5,$6,1)`,
      [sid, `${district} Govt. High School`, int(2014, 2020), `${district} College`, int(2016, 2022), pick(["4.50", "4.83", "5.00", "4.25"])]);
    if (level === "Master" || level === "PhD") {
      await q(`insert into public.student_education (student_id, level, institution, degree, major, passing_year, gpa, sort_order)
        values ($1,'Bachelor',$2,'BSc',$3,$4,$5,2)`, [sid, pick(["University of Dhaka", "BUET", "Rajshahi University", "Khulna University", "North South University"]), pick(PROGRAMS)[0], int(2020, 2025), pick(["3.25", "3.50", "3.71"])]);
      await q(`insert into public.student_work_experience (student_id, company, address, employer_phone, position, duty, supervisor_name, supervisor_phone, start_date, end_date)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [sid, pick(["Grameenphone Ltd", "BRAC", "Walton Hi-Tech", "Square Pharmaceuticals"]), "Gulshan, Dhaka", "+88029876543",
          pick(["Junior Engineer", "Officer", "Analyst"]), "Daily operations and reporting", `${pick(FIRST_M)} ${pick(LAST)}`, "+8801711999888",
          iso(addDays(TODAY, -900)), iso(addDays(TODAY, -200))]);
    }
    // family
    await q(`insert into public.student_family_members (student_id, relation, name, date_of_birth, sort_order) values
      ($1,'father',$2,$3,0), ($1,'mother',$4,$5,1)`,
      [sid, `${pick(FIRST_M)} ${fullName.split(" ").pop()}`, iso(new Date(int(1960, 1975), int(0, 11), int(1, 28))),
        `${pick(FIRST_F)} Begum`, iso(new Date(int(1965, 1980), int(0, 11), int(1, 28)))]);
    if (i % 9 === 0) {
      await q(`insert into public.student_family_members (student_id, relation, name, date_of_birth, sort_order) values ($1,'spouse',$2,$3,2)`,
        [sid, `${pick(female ? FIRST_M : FIRST_F)} ${pick(LAST)}`, iso(new Date(int(1995, 2000), int(0, 11), int(1, 28)))]);
    }
    if (i % 5 === 0) {
      await q(`insert into public.student_travel_history (student_id, kind, country, visa_type, visited_from, visited_to) values ($1,'visit',$2,'Tourist',$3,$4)`,
        [sid, pick(["India", "Thailand", "Malaysia", "Nepal"]), iso(addDays(TODAY, -200)), iso(addDays(TODAY, -190))]);
    }

    // applications for students past "applied"
    const rank = PATH.indexOf(status === "visa_rejected" ? "visa_applied" : status);
    if (rank >= 3) {
      const o1 = offerIds[i % offerIds.length], o2 = offerIds[(i * 7 + 3) % offerIds.length];
      const accepted = rank >= 4;
      await q(`insert into public.applications (student_id, offer_id, university_id, status, applied_at, decision_at, created_by)
        values ($1,$2,$3,$4,$5,$6,$7)`,
        [sid, o1.id, o1.uni, accepted ? "accepted" : pick(["submitted", "under_review"]), iso(addDays(created, 30)), accepted ? iso(addDays(created, 60)) : null, counselor]);
      if (o2.id !== o1.id) {
        await q(`insert into public.applications (student_id, offer_id, university_id, status, applied_at, decision_at, created_by)
          values ($1,$2,$3,$4,$5,$6,$7)`,
          [sid, o2.id, o2.uni, pick(["rejected", "withdrawn", "under_review", "rejected"]), iso(addDays(created, 32)), null, counselor]);
      }
    }
  }

  // ---------- sprints & tasks ----------
  console.log("• Sprints & tasks");
  const [s1] = await q<{ id: string }>(`insert into public.sprints (name, start_date, end_date, status, goal, created_by) values ($1,$2,$3,'completed',$4,$5) returning id`,
    ["Sprint 1 – September intake push", iso(addDays(TODAY, -28)), iso(addDays(TODAY, -15)), "Submit all September applications", adm]);
  const [s2] = await q<{ id: string }>(`insert into public.sprints (name, start_date, end_date, status, goal, created_by) values ($1,$2,$3,'active',$4,$5) returning id`,
    ["Sprint 2 – Visa documents", iso(addDays(TODAY, -14)), iso(addDays(TODAY, 7)), "Collect JW202 and bank solvency for all accepted students", adm]);
  const TASK_TITLES = ["Collect passport copy", "Verify HSC transcript", "Submit online application", "Follow up on admission letter",
    "Request JW202 from university", "Book visa appointment", "Prepare bank solvency letter", "Translate birth certificate",
    "Call student about missing documents", "Upload offer leaflets", "Update university fee sheet", "Arrange airport pickup",
    "Prepare visa interview sheet", "Courier documents to university", "Check CSC portal status"];
  const TASK_STATUSES = ["todo", "in_progress", "in_review", "done", "paused", "rejected"];
  for (let i = 0; i < 30; i++) {
    const inActive = i < 20;
    const status = TASK_STATUSES[i % TASK_STATUSES.length];
    const stu = studentIds[i % studentIds.length];
    const assignee = i % 3 === 0 ? op : i % 3 === 1 ? op2 : i % 5 === 0 ? fin : adm;
    const due = inActive ? addDays(TODAY, int(-5, 10)) : addDays(TODAY, -int(15, 30));
    const [t] = await q<{ id: string }>(`insert into public.tasks (title, description, assignee_id, reporter_id, priority, status, due_date, sprint_id, student_id, tags, created_by, created_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$4,$11) returning id`,
      [`${TASK_TITLES[i % TASK_TITLES.length]}${i >= TASK_TITLES.length ? " (batch 2)" : ""}`,
        `<p>${TASK_TITLES[i % TASK_TITLES.length]} for the student. Check the checklist in the Info Center before closing.</p>`,
        assignee, adm, pick(["low", "medium", "high", "urgent"]), status, iso(due), inActive ? s2.id : s1.id, rand() < 0.7 ? stu.id : null,
        [pick(["visa", "application", "documents", "follow-up"])], addDays(TODAY, inActive ? -12 : -26).toISOString()]);
    if (i % 4 === 0) {
      await q(`insert into public.task_comments (task_id, author_id, body, mentions) values ($1,$2,$3,$4)`,
        [t.id, adm, "Please prioritise this one — the deadline is close.", [assignee]]);
    }
  }

  // ---------- knowledge base ----------
  console.log("• Knowledge base");
  const checklist = readFileSync(join(process.cwd(), "supabase", "seed", "visa-interview-checklist.txt"), "utf8");
  await q(`insert into public.kb_entries (title, category, body, body_format, body_text, tags, created_by, updated_by)
    values ('Document Checklist for Visa Interview', 'Visa', $1, 'text', $1, $2, $3, $3)`, [checklist, ["visa", "checklist", "interview"], adm]);
  const KB = [
    ["CSC Scholarship – Application SOP", "SOP", "<h2>Steps</h2><ol><li>Create CSC portal account</li><li>Fill agency number</li><li>Upload notarized documents</li><li>Print and courier the application form</li></ol>", ["csc", "scholarship"]],
    ["FAQ: Can students work part-time in China?", "FAQ", "<p>Students may take part-time work only with approval from their university and the local Exit-Entry bureau. Always check the current rules with the university.</p>", ["faq", "work"]],
    ["Bank solvency letter template", "Templates", "<p>To Whom It May Concern,</p><p>This is to certify that <strong>[Name]</strong> maintains an account with balance of BDT [amount]...</p>", ["template", "bank"]],
    ["Zhejiang University – notes", "University notes", "<p>Strong engineering programs. English-taught Master programs require IELTS 6.5. Application window opens in December.</p>", ["zju", "university"]],
    ["JW202 – what it is", "Visa", "<p>The JW202 is the Visa Application for Study in China form issued by the university. It is required together with the admission letter for the X1 visa.</p>", ["jw202", "visa"]],
  ] as const;
  for (const [title, cat, body, tags] of KB) {
    const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    await q(`insert into public.kb_entries (title, category, body, body_format, body_text, tags, created_by, updated_by) values ($1,$2,$3,'html',$4,$5,$6,$6)`,
      [title, cat, body, text, tags, adm]);
  }

  // ---------- finance ----------
  console.log("• Finance");
  const cats = await q<{ id: string; type: string; name: string }>("select id, type, name from public.transaction_categories where deleted_at is null");
  const cat = (type: string, name: string) => cats.find((c) => c.type === type && c.name === name)!.id;
  const rates = { CNY: 16.8, USD: 122 } as const;
  // fee plans for 20 students
  for (let i = 0; i < 20; i++) {
    const stu = studentIds[i * 2];
    const total = pick([150000, 180000, 200000, 250000]);
    const [fp] = await q<{ id: string }>(`insert into public.fee_plans (student_id, title, total_amount, currency, created_by) values ($1,'Full service package',$2,'BDT',$3) returning id`, [stu.id, total, fin]);
    const parts = [0.4, 0.3, 0.3];
    for (let k = 0; k < 3; k++) {
      const due = addDays(stu.created, 20 + k * 45);
      const amount = Math.round(total * parts[k]);
      const [inst] = await q<{ id: string }>(`insert into public.fee_installments (fee_plan_id, label, due_date, amount, sort_order) values ($1,$2,$3,$4,$5) returning id`,
        [fp.id, `Installment ${k + 1}`, iso(due), amount, k]);
      // pay most past-due installments; leave some overdue
      if (due < TODAY && (rand() < 0.75 || k === 0)) {
        const payDate = addDays(due, -int(0, 5));
        if (payDate < addDays(TODAY, -183)) continue;
        await q(`insert into public.transactions (type, txn_date, amount, currency, exchange_rate, category_id, student_id, fee_installment_id, payment_method, reference_no, note, created_by)
          values ('income',$1,$2,'BDT',1,$3,$4,$5,$6,$7,$8,$9)`,
          [iso(payDate), amount, cat("income", "Service Charge"), stu.id, inst.id, pick(["Cash", "bKash", "Nagad", "Bank Transfer"]),
            `TRX${int(100000, 999999)}`, `Installment ${k + 1}`, fin]);
      }
    }
  }
  // 6 months of operating income & expense
  for (let m = 5; m >= 0; m--) {
    const monthStart = new Date(TODAY.getFullYear(), TODAY.getMonth() - m, 1);
    const day = (d: number) => {
      const x = new Date(monthStart.getFullYear(), monthStart.getMonth(), d);
      return x > TODAY ? TODAY : x;
    };
    const exp: [string, number, string, string][] = [
      ["Rent", 45000, "Landlord – Banani office", "Bank Transfer"],
      ["Salary", 240000, "Staff salaries", "Bank Transfer"],
      ["Utilities", int(6000, 9000), "DESCO / internet", "bKash"],
      ["Marketing/Ads", int(15000, 40000), "Meta Ads", "Card"],
      ["Courier", int(2000, 6000), "DHL", "Cash"],
      ["Office Supplies", int(1500, 5000), "Stationery shop", "Cash"],
    ];
    for (const [c, amount, vendor, method] of exp) {
      await q(`insert into public.transactions (type, txn_date, amount, currency, exchange_rate, category_id, vendor, payment_method, note, created_by)
        values ('expense',$1,$2,'BDT',1,$3,$4,$5,$6,$7)`, [iso(day(int(1, 10))), amount, cat("expense", c), vendor, method, `${c} – ${monthStart.toLocaleString("en", { month: "short" })}`, fin]);
    }
    await q(`insert into public.transactions (type, txn_date, amount, currency, exchange_rate, category_id, vendor, payment_method, note, created_by)
      values ('expense',$1,$2,'CNY',$3,$4,$5,'Bank Transfer','Application fee paid to university',$6)`,
      [iso(day(int(10, 25))), pick([400, 600, 800]), rates.CNY, cat("expense", "Application Fees Paid to University"), pick(UNIVERSITIES)[0], fin]);
    for (let k = 0; k < int(3, 6); k++) {
      const stu = pick(studentIds);
      await q(`insert into public.transactions (type, txn_date, amount, currency, exchange_rate, category_id, student_id, payment_method, reference_no, created_by)
        values ('income',$1,$2,'BDT',1,$3,$4,$5,$6,$7)`,
        [iso(day(int(1, 28))), pick([5000, 10000, 15000, 25000]), cat("income", pick(["Application Fee", "Visa Processing Fee"])), stu.id,
          pick(["Cash", "bKash", "Nagad"]), `TRX${int(100000, 999999)}`, fin]);
    }
    await q(`insert into public.transactions (type, txn_date, amount, currency, exchange_rate, category_id, vendor, payment_method, note, created_by)
      values ('income',$1,$2,'USD',$3,$4,'Beijing EduLink Partners','Bank Transfer','Partner commission',$5)`,
      [iso(day(int(15, 28))), pick([300, 500, 800]), rates.USD, cat("income", "Partner Commission"), fin]);
  }

  // ---------- final ----------
  await q("delete from public.notifications");
  await q("delete from public.audit_logs");
  await q("select public.generate_scheduled_notifications()");
  await db.end();
  console.log("\nSeed complete. Logins:");
  for (const u of SEED_USERS) console.log(`  ${u.role.padEnd(17)} ${u.email.padEnd(22)} ${u.password}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
