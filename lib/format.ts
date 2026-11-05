import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { TZ } from "./constants";

/** Today's date in Asia/Dhaka as yyyy-MM-dd */
export function todayDhaka(): string {
  return formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
}

function toDate(v: string | Date): Date {
  if (v instanceof Date) return v;
  // plain dates (yyyy-MM-dd) are calendar dates, not instants
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return parseISO(v + "T00:00:00+06:00");
  return new Date(v);
}

export function fmtDate(v: string | Date | null | undefined, pattern = "dd MMM yyyy"): string {
  if (!v) return "—";
  return formatInTimeZone(toDate(v), TZ, pattern);
}

export function fmtDateTime(v: string | Date | null | undefined): string {
  if (!v) return "—";
  return formatInTimeZone(toDate(v), TZ, "dd MMM yyyy, h:mm a");
}

export function fmtRelative(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const d = toDate(v);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return fmtDate(d);
}

/** Days from today (Dhaka) to a yyyy-MM-dd date; negative = past */
export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const today = toZonedTime(new Date(), TZ);
  return differenceInCalendarDays(toDate(date), parseISO(formatInTimeZone(today, TZ, "yyyy-MM-dd") + "T00:00:00+06:00"));
}

const SYMBOL: Record<string, string> = { BDT: "৳", CNY: "¥", USD: "$" };

export function fmtMoney(amount: number | string | null | undefined, currency = "BDT", opts: { compact?: boolean } = {}): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = typeof amount === "string" ? Number(amount) : amount;
  const s = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: opts.compact ? 1 : 2,
    minimumFractionDigits: opts.compact ? 0 : n % 1 === 0 ? 0 : 2,
    notation: opts.compact ? "compact" : "standard",
  }).format(n);
  return `${SYMBOL[currency] ?? currency + " "}${s}`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function humanize(v: string | null | undefined): string {
  if (!v) return "—";
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function bytes(n: number | null | undefined): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
