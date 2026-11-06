"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { CURRENCIES } from "@/lib/currencies";

/**
 * "Which currency is this account in?" plus, when it isn't the main currency and a balance is typed,
 * the rate to the main currency (with a button to fetch today's rate).
 */
export function CurrencyPick({ primary, value = "", fixed, needRate, label = "Currency of this account" }: {
  primary: string;
  value?: string;
  /** Show the rate for this currency only, without a choice (e.g. the starting balance of a dollar account). */
  fixed?: string;
  needRate?: boolean;
  label?: string;
}) {
  const [cur, setCur] = useState(fixed || value || primary);
  const selectValue = cur === primary ? "" : cur;
  const [rate, setRate] = useState("");
  const [msg, setMsg] = useState("");
  const foreign = cur !== primary;

  async function today(c: string) {
    setMsg("Getting today's rate…");
    try {
      const j = await (await fetch(`/api/rate?from=${c}&to=${primary}`)).json();
      if (j.rate) (setRate(String(j.rate)), setMsg("Today's market rate. You can change it."));
      else setMsg(j.error || "Please type the rate.");
    } catch {
      setMsg("Please type the rate.");
    }
  }

  return (
    <div className="space-y-2">
      {!fixed && (
        <div>
          <label className="label" htmlFor="acc-currency">{label}</label>
          <select
            id="acc-currency"
            name="currency"
            value={selectValue}
            onChange={(e) => {
              const c = e.target.value || primary;
              setCur(c);
              setRate("");
              if (needRate && c !== primary) today(c);
            }}
            className="input"
          >
            {CURRENCIES.map(([c, n]) => <option key={c} value={c === primary ? "" : c}>{c} – {n}{c === primary ? " (main)" : ""}</option>)}
          </select>
          {foreign && <p className="mt-1 text-sm text-muted">Its balance will show in {cur}, with the {primary} value next to it.</p>}
        </div>
      )}
      {foreign && needRate && (
        <div className="grid items-end gap-2 sm:grid-cols-[1fr_auto]">
          <div>
            <label className="label" htmlFor="acc-rate">Rate: {primary} for 1 {cur}</label>
            <input id="acc-rate" name="rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 280" className="input" />
          </div>
          <button type="button" onClick={() => today(cur)} className="btn-ghost"><RefreshCw className="h-4 w-4" />Today&apos;s rate</button>
          {msg && <p className="text-sm text-muted sm:col-span-2">{msg}</p>}
        </div>
      )}
    </div>
  );
}
