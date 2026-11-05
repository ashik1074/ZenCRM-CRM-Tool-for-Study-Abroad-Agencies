import { todayDhaka } from "./format";
import { sp, type SearchParams } from "./url";

export const PERIODS = [
  { value: "month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "quarter", label: "This quarter" },
  { value: "year", label: "This year" },
  { value: "last_12", label: "Last 12 months" },
  { value: "custom", label: "Custom" },
] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** Resolve ?period= (or ?from/&to for custom) into an inclusive Dhaka date range. */
export function resolvePeriod(params: SearchParams, fallback: string = "year") {
  const period = sp(params, "period") ?? (sp(params, "from") || sp(params, "to") ? "custom" : fallback);
  const today = todayDhaka();
  const [y, m] = today.split("-").map(Number);
  const mi = m - 1;
  let from = today, to = today;
  switch (period) {
    case "month": from = `${y}-${pad(m)}-01`; break;
    case "last_month": {
      const ly = mi === 0 ? y - 1 : y, lm = mi === 0 ? 11 : mi - 1;
      from = `${ly}-${pad(lm + 1)}-01`; to = `${ly}-${pad(lm + 1)}-${lastDay(ly, lm)}`; break;
    }
    case "quarter": { const q = Math.floor(mi / 3) * 3; from = `${y}-${pad(q + 1)}-01`; break; }
    case "last_12": { const d = new Date(Date.UTC(y, mi - 11, 1)); from = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`; break; }
    case "custom":
      from = sp(params, "from") ?? `${y}-01-01`;
      to = sp(params, "to") ?? today;
      break;
    default: from = `${y}-01-01`;
  }
  if (from > to) [from, to] = [to, from];
  return { period, from, to };
}
