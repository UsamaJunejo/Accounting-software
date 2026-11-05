"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { CURRENCIES } from "@/lib/currencies";
import { updateCurrency } from "@/app/actions/auth";

export function CurrencySettings({ current, hasEntries }: { current: string; hasEntries: boolean }) {
  const [next, setNext] = useState(current);
  const [convert, setConvert] = useState(hasEntries);
  const [rate, setRate] = useState("");
  const [msg, setMsg] = useState("");
  const changing = next !== current;

  async function fetchRate() {
    setMsg("Getting today's rate…");
    try {
      const j = await (await fetch(`/api/rate?from=${current}&to=${next}`)).json();
      if (j.rate) {
        setRate(String(j.rate));
        setMsg("Today's market rate. Check it before saving.");
      } else setMsg(j.error || "Please type the rate.");
    } catch {
      setMsg("Please type the rate.");
    }
  }

  return (
    <form
      action={updateCurrency}
      className="space-y-3"
      onSubmit={(e) => {
        if (changing && convert && !confirm(`Convert every amount from ${current} to ${next} at ${rate}? This changes all your records.`)) e.preventDefault();
      }}
    >
      <div>
        <label className="label" htmlFor="main-currency">Main currency</label>
        <select id="main-currency" name="currency" value={next} onChange={(e) => { setNext(e.target.value); setRate(""); setMsg(""); }} className="input">
          {CURRENCIES.map(([c, n]) => <option key={c} value={c}>{c} – {n}</option>)}
        </select>
        <p className="mt-1 text-sm text-muted">All balances and reports are kept in this currency. Entries in other currencies are converted when you save them.</p>
      </div>
      {changing && (
        <div className="space-y-3 rounded-md border border-rule bg-paper p-3">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="convert" checked={convert} onChange={(e) => setConvert(e.target.checked)} className="mt-1" />
            <span>
              <b>Convert my existing records</b> from {current} to {next}.
              <br />
              <span className="text-muted">Leave this off if you only picked the wrong currency when you signed up and the numbers are already right.</span>
            </span>
          </label>
          {convert && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1">
                <label className="label" htmlFor="conv-rate">1 {current} = how many {next}?</label>
                <input id="conv-rate" name="rate" required inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} className="input" />
              </div>
              <button type="button" onClick={fetchRate} className="btn-ghost"><RefreshCw className="h-4 w-4" />Today&apos;s rate</button>
              {msg && <p className="w-full text-sm text-muted">{msg}</p>}
            </div>
          )}
        </div>
      )}
      <button className="btn-dark" disabled={!changing}>Save currency</button>
    </form>
  );
}
