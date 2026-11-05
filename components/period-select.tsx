"use client";

import { useState } from "react";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

function ranges(todayIso: string): Record<string, [string, string]> {
  const t = new Date(todayIso + "T00:00:00Z");
  const y = t.getUTCFullYear(), m = t.getUTCMonth(), d = t.getUTCDate();
  const dow = (t.getUTCDay() + 6) % 7; // Monday = 0
  return {
    today: [todayIso, todayIso],
    week: [iso(utc(y, m, d - dow)), todayIso],
    month: [iso(utc(y, m, 1)), iso(utc(y, m + 1, 0))],
    last: [iso(utc(y, m - 1, 1)), iso(utc(y, m, 0))],
    year: [iso(utc(y, 0, 1)), iso(utc(y, 11, 31))],
  };
}

const LABEL: Record<string, string> = { today: "Today", week: "This week", month: "This month", last: "Last month", year: "This year", custom: "Custom dates" };

/**
 * One small "This month ▾" picker instead of two date boxes. Choosing a period fills the
 * form's hidden from/to and sends it; "Custom dates" shows the two date boxes.
 */
export function PeriodSelect({ from, to, today }: { from: string; to: string; today: string }) {
  const r = ranges(today);
  const match = Object.entries(r).find(([, [a, b]]) => a === from && b === to)?.[0] ?? "custom";
  const [mode, setMode] = useState(match);
  return (
    <>
      <div>
        <label className="label" htmlFor="period">Period</label>
        <select
          id="period"
          className="input w-auto pe-9"
          value={mode}
          onChange={(e) => {
            const v = e.target.value;
            setMode(v);
            if (v === "custom") return;
            const form = e.target.form!;
            (form.elements.namedItem("from") as HTMLInputElement).value = r[v][0];
            (form.elements.namedItem("to") as HTMLInputElement).value = r[v][1];
            form.requestSubmit();
          }}
        >
          {Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className={mode === "custom" ? "" : "hidden"}>
        <label className="label" htmlFor="from">From</label>
        <input id="from" type="date" name="from" defaultValue={from} className="input" />
      </div>
      <div className={mode === "custom" ? "" : "hidden"}>
        <label className="label" htmlFor="to">To</label>
        <input id="to" type="date" name="to" defaultValue={to} className="input" />
      </div>
    </>
  );
}
