"use client";

import { useState } from "react";
import { CURRENCIES } from "@/lib/currencies";
import { updateCurrency } from "@/app/actions/auth";
import { ConfirmButton } from "@/components/confirm-button";
import { RateNote } from "@/components/rate-note";

export function CurrencySettings({ current, hasEntries }: { current: string; hasEntries: boolean }) {
  const [next, setNext] = useState(current);
  const [convert, setConvert] = useState(hasEntries);
  const [rate, setRate] = useState<number | null>(null);
  const changing = next !== current;

  return (
    <form action={updateCurrency} className="space-y-3">
      <div>
        <label className="label" htmlFor="main-currency">Main currency</label>
        <select id="main-currency" name="currency" value={next} onChange={(e) => { setNext(e.target.value); setRate(null); }} className="input">
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
          {convert && <RateNote from={current} to={next} onRate={setRate} />}
        </div>
      )}
      {changing && convert ? (
        <ConfirmButton className="btn-dark" message={`Convert every amount from ${current} to ${next} at today’s rate (1 ${current} = ${rate ?? "?"} ${next})? This changes all your records.`} confirmLabel="Convert my records" danger={false}>
          Save currency
        </ConfirmButton>
      ) : (
        <button className="btn-dark" disabled={!changing}>Save currency</button>
      )}
    </form>
  );
}
