"use client";

import { useState } from "react";
import { CURRENCIES } from "@/lib/currencies";
import { RateNote } from "@/components/rate-note";

/**
 * "Which currency is this account in?" and, when it isn't the main currency, today's rate to the main
 * currency. The rate is only shown: the app fetches it daily and uses that same rate when saving.
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
  const foreign = cur !== primary;

  return (
    <div className="space-y-2">
      {!fixed && (
        <div>
          <label className="label" htmlFor="acc-currency">{label}</label>
          <select id="acc-currency" name="currency" value={cur === primary ? "" : cur} onChange={(e) => setCur(e.target.value || primary)} className="input">
            {CURRENCIES.map(([c, n]) => <option key={c} value={c === primary ? "" : c}>{c} – {n}{c === primary ? " (main)" : ""}</option>)}
          </select>
          {foreign && <p className="mt-1 text-sm text-muted">Its balance will show in {primary}, worked out at each day&apos;s rate, with {cur} underneath.</p>}
        </div>
      )}
      {foreign && needRate && <RateNote from={cur} to={primary} />}
    </div>
  );
}
