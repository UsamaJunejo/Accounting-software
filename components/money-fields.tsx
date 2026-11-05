"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { CURRENCIES } from "@/lib/currencies";

const fmt = (n: number) => new Intl.NumberFormat("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const num = (s: string) => Number(String(s).replace(/,/g, ""));

/** Amount in PKR, or in another currency with an exchange rate (PKR is worked out). */
export function MoneyFields({
  amount,
  currency = "PKR",
  foreignAmount,
  rate,
}: {
  amount?: string;
  currency?: string;
  foreignAmount?: string;
  rate?: string;
}) {
  const [cur, setCur] = useState(currency);
  const [fx, setFx] = useState(foreignAmount ?? "");
  const [r, setR] = useState(rate ?? "");
  const [msg, setMsg] = useState("");
  const pkr = num(fx) * num(r);

  async function fetchRate(c: string) {
    setMsg("Getting today's rate…");
    try {
      const res = await fetch(`/api/rate?c=${c}`);
      const j = await res.json();
      if (j.rate) {
        setR(String(j.rate));
        setMsg("Today's market rate. You can change it.");
      } else setMsg(j.error || "Please type the rate.");
    } catch {
      setMsg("Please type the rate.");
    }
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        {cur === "PKR" ? (
          <div>
            <label className="label">Amount (PKR)</label>
            <input name="amount" inputMode="decimal" required autoFocus placeholder="0.00" defaultValue={amount} className="input text-lg font-semibold" />
          </div>
        ) : (
          <div>
            <label className="label">Amount ({cur})</label>
            <input name="foreign_amount" inputMode="decimal" required autoFocus value={fx} onChange={(e) => setFx(e.target.value)} placeholder="0.00" className="input text-lg font-semibold" />
          </div>
        )}
        <div>
          <label className="label">Currency</label>
          <select
            name="currency"
            value={cur}
            onChange={(e) => {
              setCur(e.target.value);
              if (e.target.value !== "PKR" && !r) fetchRate(e.target.value);
              else setMsg("");
            }}
            className="input"
          >
            {CURRENCIES.map(([c, n]) => (
              <option key={c} value={c}>{c} · {n}</option>
            ))}
          </select>
        </div>
      </div>
      {cur !== "PKR" && (
        <div className="grid items-end gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_auto_1fr]">
          <div>
            <label className="label">Rate (PKR for 1 {cur})</label>
            <input name="rate" inputMode="decimal" required value={r} onChange={(e) => setR(e.target.value)} className="input" />
          </div>
          <button type="button" onClick={() => fetchRate(cur)} className="btn-ghost"><RefreshCw className="h-4 w-4" />Today&apos;s rate</button>
          <div>
            <div className="label">In PKR</div>
            <div className="py-2 text-lg font-bold text-ink">{pkr > 0 ? `Rs ${fmt(pkr)}` : "—"}</div>
          </div>
          {msg && <p className="text-xs text-slate-500 sm:col-span-3">{msg}</p>}
        </div>
      )}
    </div>
  );
}
