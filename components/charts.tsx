"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

// Chart tokens (validated for colour-blind readers: in/out pass every check on white).
const C = {
  in: "#2a78d6",
  out: "#c2263a",
  line: "var(--color-brand)",
  bar: "var(--color-brand)",
  grid: "#e6ecef",
  axis: "#5a6b73",
  text: "#24343b",
};

const short = (v: number) => {
  const a = Math.abs(v);
  if (a >= 10_000_000) return `${(v / 10_000_000).toFixed(1)} cr`;
  if (a >= 100_000) return `${(v / 100_000).toFixed(1)} lac`;
  if (a >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(Math.round(v));
};
const full = (v: number) => new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(v);
const day = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

type TipItem = { dataKey?: string | number; name?: string; value?: number | string; color?: string };
function Tip({
  active,
  payload,
  label,
  cur,
  labelFormat,
}: { active?: boolean; payload?: TipItem[]; label?: string | number; cur: string; labelFormat?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-white/80 bg-white/90 px-3 py-2 text-sm shadow-lg backdrop-blur">
      <div className="mb-1 font-semibold text-ink">{labelFormat ? labelFormat(String(label)) : label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2 text-body">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
          {p.name}: <b dir="ltr">{cur} {full(Number(p.value))}</b>
        </div>
      ))}
    </div>
  );
}

const axisProps = { stroke: C.grid, tick: { fill: C.axis, fontSize: 12 }, tickLine: false } as const;

function Empty({ text }: { text: string }) {
  return <p className="flex h-[220px] items-center justify-center text-center text-[15px] text-muted">{text}</p>;
}

/** One line: how much cash & bank you held each day. */
export function BalanceLine({
  data,
  cur,
  name = "Balance",
  empty = "No entries yet.",
}: {
  data: { date: string; balance: number }[];
  cur: string;
  name?: string;
  empty?: string;
}) {
  if (!data.length) return <Empty text={empty} />;
  const pts = data.map((d) => ({ date: d.date, balance: d.balance / 100 }));
  const min = Math.min(...pts.map((p) => p.balance));
  return (
    <div role="img" aria-label={`${name} over time`}>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={pts} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="date" {...axisProps} tickFormatter={day} minTickGap={28} />
          <YAxis {...axisProps} axisLine={false} tickFormatter={short} width={56} />
          {min < 0 && <ReferenceLine y={0} stroke={C.axis} />}
          <Tooltip content={<Tip cur={cur} labelFormat={day} />} cursor={{ stroke: C.axis, strokeWidth: 1 }} />
          <Line type="monotone" dataKey="balance" name={name} stroke={C.line} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Money in vs money out per period. Two series, so a legend is always shown. */
export function InOutBars({
  data,
  cur,
  labels = { in: "Money in", out: "Money out" },
}: {
  data: { label: string; in: number; out: number }[];
  cur: string;
  labels?: { in: string; out: string };
}) {
  const pts = data.map((d) => ({ label: d.label, in: d.in / 100, out: d.out / 100 }));
  return (
    <div>
      <div className="mb-2 flex gap-4 text-sm text-body" aria-hidden="true">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C.in }} />{labels.in}</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C.out }} />{labels.out}</span>
      </div>
      <div role="img" aria-label={`${labels.in} and ${labels.out} by month`}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={pts} margin={{ top: 8, right: 12, left: 4, bottom: 0 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} axisLine={false} tickFormatter={short} width={56} />
            <Tooltip content={<Tip cur={cur} />} cursor={{ fill: "#e6ecf4", opacity: 0.6 }} />
            <Bar dataKey="in" name={labels.in} fill={C.in} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            <Bar dataKey="out" name={labels.out} fill={C.out} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Ranked horizontal bars, biggest first: easier to compare than a pie. One colour, one series. */
export function RankedBars({
  data,
  cur,
  name = "Amount",
  empty = "Nothing to show yet.",
  color = C.bar,
}: {
  data: { name: string; value: number }[];
  cur: string;
  name?: string;
  empty?: string;
  color?: string;
}) {
  if (!data.length) return <Empty text={empty} />;
  const pts = data.map((d) => ({ name: d.name, value: d.value / 100 }));
  const height = Math.max(120, pts.length * 34 + 24);
  return (
    <div role="img" aria-label={name}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={pts} layout="vertical" margin={{ top: 0, right: 56, left: 4, bottom: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={130} tick={{ fill: C.text, fontSize: 13 }} tickLine={false} axisLine={false} />
          <Tooltip content={<Tip cur={cur} />} cursor={{ fill: "#e6ecf4", opacity: 0.6 }} />
          <Bar
            dataKey="value"
            name={name}
            fill={color}
            radius={[0, 4, 4, 0]}
            maxBarSize={20}
            isAnimationActive={false}
            label={{ position: "right", fill: C.text, fontSize: 12, formatter: (v: unknown) => short(Number(v)) }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type Slice = { name: string; value: number; color: string };

/** Donut: what you own, split by category. Each slice keeps its category's colour, and a legend
 *  with names and amounts sits beside it, so identity never depends on colour alone. */
export function CategoryDonut({ data, cur, empty = "Nothing to show yet." }: { data: Slice[]; cur: string; empty?: string }) {
  const rows = data.filter((d) => d.value > 0);
  if (!rows.length) return <Empty text={empty} />;
  const total = rows.reduce((s, d) => s + d.value, 0);
  const pts = rows.map((d) => ({ ...d, value: d.value / 100 }));
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[200px_1fr]">
      <div className="relative" role="img" aria-label="What you own, by category">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={pts} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={1.5} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
              {pts.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip content={<Tip cur={cur} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted">Total</span>
          <span className="text-lg font-bold text-ink" dir="ltr">{short(total / 100)}</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-[15px]">
        {rows.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: d.color }} />
            <span className="flex-1 text-body">{d.name}</span>
            <span className="tabular-nums text-muted">{Math.round((d.value / total) * 100)}%</span>
            <span className="w-24 text-end tabular-nums font-semibold text-ink" dir="ltr">{full(d.value / 100)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Bars per category, above or below zero, each in its category colour (MunshiBaba's bar graph). */
export function CategoryBars({ data, cur }: { data: Slice[]; cur: string }) {
  const pts = data.map((d) => ({ ...d, value: d.value / 100 }));
  const hasNeg = pts.some((d) => d.value < 0);
  return (
    <div role="img" aria-label="Balance of each category">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={pts} margin={{ top: 16, right: 12, left: 4, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="name" {...axisProps} interval={0} tick={{ fill: C.axis, fontSize: 12 }} />
          <YAxis {...axisProps} axisLine={false} tickFormatter={short} width={56} />
          {hasNeg && <ReferenceLine y={0} stroke={C.axis} />}
          <Tooltip content={<Tip cur={cur} />} cursor={{ fill: "#e6ecef", opacity: 0.6 }} />
          <Bar dataKey="value" name="Balance" radius={4} maxBarSize={44} isAnimationActive={false}>
            {pts.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
