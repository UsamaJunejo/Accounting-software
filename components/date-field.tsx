"use client";

import { useState } from "react";

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/** Date box with one-tap "Today" and "Yesterday". */
export function DateField({ name = "date", defaultValue, label = "Date" }: { name?: string; defaultValue: string; label?: string }) {
  const [v, setV] = useState(defaultValue);
  const today = iso(new Date());
  const yesterday = iso(new Date(Date.now() - 86_400_000));
  const chip = (d: string, text: string) => (
    <button
      type="button"
      onClick={() => setV(d)}
      aria-pressed={v === d}
      className={`rounded-full px-3 py-1 text-sm font-semibold ${v === d ? "bg-peacock text-white" : "bg-peacock-soft text-peacock hover:bg-peacock/15"}`}
    >
      {text}
    </button>
  );
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="label mb-0" htmlFor={`df-${name}`}>{label}</label>
        <span className="flex gap-1.5">{chip(today, "Today")}{chip(yesterday, "Yesterday")}</span>
      </div>
      <input id={`df-${name}`} type="date" name={name} required value={v} onChange={(e) => setV(e.target.value)} className="input" />
    </div>
  );
}
