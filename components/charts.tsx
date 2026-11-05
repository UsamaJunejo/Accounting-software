"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#f7931e", "#0f1d33", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#14b8a6", "#64748b"];
const fmt = (v: number) => new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(v);

export function ExpensePie({ data, empty = "No expenses in this period." }: { data: { name: string; value: number }[]; empty?: string }) {
  if (!data.length) return <p className="py-16 text-center text-sm text-slate-500">{empty}</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2} isAnimationActive={false}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => `Rs ${fmt(Number(v))}`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function MonthlyBars({ data, labels = { income: "Income", expense: "Expense" } }: { data: { month: string; income: number; expense: number }[]; labels?: { income: string; expense: string } }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis fontSize={12} tickFormatter={fmt} tickLine={false} axisLine={false} width={70} />
        <Tooltip formatter={(v) => `Rs ${fmt(Number(v))}`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="income" name={labels.income} fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" name={labels.expense} fill="#f7931e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
