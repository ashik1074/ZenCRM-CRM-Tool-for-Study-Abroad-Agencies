/**
 * Fills the "Document Checklist for Visa Interview" template (from the knowledge base) with a student's data.
 * Matching is by line label, so the template wording/structure is preserved exactly; only values are appended.
 */
export type VisaSheetStudent = {
  full_name: string;
  passport_no: string | null;
  phone: string | null;
  email: string | null;
  previous_china_visa: boolean;
  previous_china_residence: boolean;
  education: { level: string; institution: string; degree: string | null; major: string | null; sort_order?: number }[];
  work: { company: string; address: string | null; employer_phone: string | null; position: string | null; duty: string | null; supervisor_name: string | null; supervisor_phone: string | null; start_date: string | null; end_date: string | null }[];
  family: { relation: string; name: string; date_of_birth: string | null }[];
  travel: { kind: string; country: string; visa_type: string | null; valid_until: string | null; visited_from: string | null; visited_to: string | null }[];
};

const ymd = (d: string | null | undefined) => (d ? d.replace(/-/g, "/") : "");
const HSC_AND_ABOVE = ["HSC", "Diploma", "Bachelor", "Master"];

export function fillVisaSheet(template: string, s: VisaSheetStudent): string {
  const work = [...s.work].sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""))[0];
  const edu = s.education
    .filter((e) => HSC_AND_ABOVE.includes(e.level))
    .sort((a, b) => HSC_AND_ABOVE.indexOf(a.level) - HSC_AND_ABOVE.indexOf(b.level));
  const father = s.family.find((f) => f.relation === "father");
  const mother = s.family.find((f) => f.relation === "mother");
  const spouse = s.family.find((f) => f.relation === "spouse");
  const children = s.family.filter((f) => f.relation === "child");
  const visas = s.travel.filter((t) => t.kind === "valid_visa");
  const visits = s.travel.filter((t) => t.kind === "visit");

  let school = -1, degree = -1, major = -1;
  let pendingAnswer: "visa" | "visit" | null = null;

  const fill = (line: string, value: string | null | undefined) => (value ? `${line.replace(/\s+$/, "")} ${value}` : line);

  const lines = template.split("\n").map((line) => {
    const t = line.trim();
    if (t.startsWith("Start Date")) return fill(line, ymd(work?.start_date));
    if (t.startsWith("End Date")) return fill(line, ymd(work?.end_date));
    if (t.startsWith("Name of Company")) return fill(line, work?.company);
    if (t.startsWith("Address Of Employer")) return fill(line, work?.address);
    if (t.startsWith("Telephone number of your employer")) return fill(line, work?.employer_phone);
    if (t.startsWith("Position:")) return fill(line, work?.position);
    if (t.startsWith("Duty:")) return fill(line, work?.duty);
    if (t.startsWith("Supervisor's name")) return fill(line, work?.supervisor_name);
    if (t.startsWith("Supervisor's Telephone")) return fill(line, work?.supervisor_phone);
    if (t.startsWith("Name of school")) return fill(line, edu[++school]?.institution);
    if (t.startsWith("Diploma/Degree")) return fill(line, edu[++degree]?.degree ?? edu[degree]?.level);
    if (t.startsWith("Major:")) return fill(line, edu[++major]?.major);
    if (t.startsWith("Your Phone Number")) return fill(line, s.phone);
    if (t.startsWith("Your Gmail")) return fill(line, s.email);
    if (t.startsWith("Father Date of Birth")) return fill(line, ymd(father?.date_of_birth));
    if (t.startsWith("Mother Date of Birth")) return fill(line, ymd(mother?.date_of_birth));
    if (t.startsWith("Spouse Name")) return fill(line, spouse?.name);
    if (t.startsWith("Spouse Date of Birth")) return fill(line, ymd(spouse?.date_of_birth));
    if (t.startsWith("Children Name")) return fill(line, children.map((c) => c.name).join(", "));
    if (t.startsWith("Children Date of Birth")) return fill(line, children.map((c) => ymd(c.date_of_birth)).join(", "));
    if (t.startsWith("Do you currently hold any valid visas")) pendingAnswer = "visa";
    if (t.startsWith("Have you travelled to any other countries")) pendingAnswer = "visit";
    if (/^Ans[.:]/.test(t) && pendingAnswer) {
      const kind = pendingAnswer;
      pendingAnswer = null;
      if (kind === "visa")
        return fill(line, visas.length ? "Yes — " + visas.map((v) => [v.country, v.visa_type, v.valid_until && `valid until ${ymd(v.valid_until)}`].filter(Boolean).join(" ")).join("; ") : "No");
      return fill(line, visits.length ? "Yes — " + visits.map((v) => [v.country, v.visited_from && `${ymd(v.visited_from)}–${ymd(v.visited_to)}`].filter(Boolean).join(" ")).join("; ") : "No");
    }
    if (t === "Ans. Sent all China Visa Copy") return s.previous_china_visa ? line : line.replace("Sent all China Visa Copy", "No");
    if (t === "Ans. Sent all China residence Copy") return s.previous_china_residence ? line : line.replace("Sent all China residence Copy", "No");
    return line;
  });

  const header = `Student: ${s.full_name}${s.passport_no ? `   Passport: ${s.passport_no}` : ""}`;
  return `${header}\n\n${lines.join("\n")}`;
}
