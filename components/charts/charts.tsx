"use client";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { fmtMoney } from "@/lib/format";

/** Categorical slots in fixed order (never cycled). Values come from CSS vars so dark mode uses its own steps. */
export const SERIES = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`);
export type ValueFormat = "number" | "money" | "percent";

export function formatValue(v: number | string, f: ValueFormat = "number") {
  const n = Number(v);
  if (f === "money") return fmtMoney(n, "BDT", { compact: Math.abs(n) >= 100000 });
  if (f === "percent") return `${n}%`;
  return new Intl.NumberFormat("en-IN").format(n);
}

const axisProps = { stroke: "var(--chart-axis)", tick: { fill: "var(--chart-axis)", fontSize: 12 }, tickLine: false, axisLine: false } as const;

function TooltipBox({ active, payload, label, format }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; format: ValueFormat }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      {label && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-medium tabular-nums">{formatValue(p.value, format)}</span>
        </p>
      ))}
    </div>
  );
}

type Series = { key: string; label: string };

export function BarChartView({
  data, xKey, series, format = "number", horizontal, height = 280, stacked,
}: { data: Record<string, unknown>[]; xKey: string; series: Series[]; format?: ValueFormat; horizontal?: boolean; height?: number; stacked?: boolean }) {
  if (!data.length) return <EmptyChart height={height} />;
  return (
    <ResponsiveContainer width="100%" height={horizontal ? Math.max(height, data.length * 34 + 40) : height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 16, bottom: 0, left: horizontal ? 8 : 0 }} barGap={2} barCategoryGap="24%">
        <CartesianGrid stroke="var(--chart-grid)" vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" {...axisProps} tickFormatter={(v) => formatValue(v, format)} allowDecimals={false} />
            <YAxis type="category" dataKey={xKey} {...axisProps} width={150} interval={0} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" />
            <YAxis {...axisProps} tickFormatter={(v) => formatValue(v, format)} width={64} allowDecimals={false} />
          </>
        )}
        <Tooltip cursor={{ fill: "var(--chart-grid)", opacity: 0.5 }} content={<TooltipBox format={format} />} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={SERIES[i]}
            stackId={stacked ? "a" : undefined}
            stroke="var(--chart-surface)"
            strokeWidth={stacked ? 2 : 0}
            radius={stacked ? (i === series.length - 1 ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0) : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={36}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineChartView({ data, xKey, series, format = "number", height = 280 }: { data: Record<string, unknown>[]; xKey: string; series: Series[]; format?: ValueFormat; height?: number }) {
  if (!data.length) return <EmptyChart height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" />
        <YAxis {...axisProps} tickFormatter={(v) => formatValue(v, format)} width={64} allowDecimals={false} />
        <Tooltip cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }} content={<TooltipBox format={format} />} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={SERIES[i]} strokeWidth={2}
            dot={{ r: 4, fill: SERIES[i], stroke: "var(--chart-surface)", strokeWidth: 2 }} activeDot={{ r: 6, stroke: "var(--chart-surface)", strokeWidth: 2 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Donut with a side legend. More than 7 slices fold into "Other" (no generated 9th hue). */
export function DonutChartView({ data, format = "number", height = 260 }: { data: { name: string; value: number }[]; format?: ValueFormat; height?: number }) {
  const clean = data.filter((d) => Number(d.value) > 0).sort((a, b) => b.value - a.value);
  if (!clean.length) return <EmptyChart height={height} />;
  const slices = clean.length > 8 ? [...clean.slice(0, 7), { name: "Other", value: clean.slice(7).reduce((s, d) => s + Number(d.value), 0) }] : clean;
  const total = slices.reduce((s, d) => s + Number(d.value), 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative w-full sm:w-1/2" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<TooltipBox format={format} />} />
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={1} stroke="var(--chart-surface)" strokeWidth={2}>
              {slices.map((s, i) => <Cell key={s.name} fill={SERIES[i]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-lg font-semibold">{formatValue(total, format)}</span>
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-sm sm:w-1/2">
        {slices.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: SERIES[i] }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            <span className="tabular-nums text-muted-foreground">{Math.round((100 * s.value) / total)}%</span>
            <span className="tabular-nums font-medium">{formatValue(s.value, format)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyChart({ height }: { height: number }) {
  return <div className="flex items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground" style={{ height }}>No data for this period.</div>;
}
