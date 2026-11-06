"use client";

import { useEffect, useRef, useState } from "react";
import { CURRENCIES } from "@/lib/currencies";
import { RateNote } from "@/components/rate-note";

const num = (s: string) => Number(String(s).replace(/,/g, ""));

/** Amount in the main currency, or in another currency at today's rate (shown, not editable; the server uses the same rate). */
export function MoneyFields({
  amount,
  primary = "PKR",
  currency,
  foreignAmount,
  accountCurrencies = {},
}: {
  /** Accounts kept in another currency: id → currency. Picking one switches the amount to it. */
  accountCurrencies?: Record<number, string>;
  amount?: string;
  primary?: string;
  currency?: string;
  foreignAmount?: string;
  rate?: string;
}) {
  const [cur, setCur] = useState(currency ?? primary);
  const [fx, setFx] = useState(foreignAmount ?? "");

  // When From or To is an account kept in another currency, the amount must be in that currency.
  const picked = useRef<{ from?: number; to?: number }>({});
  const known = useRef<Record<number, string>>({ ...accountCurrencies });
  const curRef = useRef(cur);
  const auto = useRef(false);
  curRef.current = cur;
  useEffect(() => {
    const apply = () => {
      const { from, to } = picked.current;
      const need = (from && known.current[from]) || (to && known.current[to]) || "";
      if (need && curRef.current !== need) {
        setCur(need);
        auto.current = true;
      } else if (!need && auto.current && curRef.current !== primary) {
        // We switched it for a foreign account that's no longer picked: back to the main currency.
        setCur(primary);
        auto.current = false;
      }
    };
    const onPick = (e: Event) => {
      const d = (e as CustomEvent<{ name: string; id?: number }>).detail;
      if (d.name === "from" || d.name === "to") {
        picked.current = { ...picked.current, [d.name]: d.id };
        apply();
      }
    };
    const onAdded = (e: Event) => {
      const d = (e as CustomEvent<{ id: number; currency?: string | null }>).detail;
      if (d.currency) known.current[d.id] = d.currency;
    };
    window.addEventListener("fc-pick", onPick);
    window.addEventListener("fc-added", onAdded);
    window.dispatchEvent(new Event("fc-ask"));
    return () => {
      window.removeEventListener("fc-pick", onPick);
      window.removeEventListener("fc-added", onAdded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="grid gap-3 sm:grid-cols-[1fr_280px]">
        {cur === primary ? (
          <div>
            <label className="label" htmlFor="amount">Amount ({primary})</label>
            <input id="amount" name="amount" inputMode="decimal" required autoFocus placeholder="0.00" defaultValue={amount} className="input text-lg font-semibold" />
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="foreign_amount">Amount ({cur})</label>
            <input id="foreign_amount" name="foreign_amount" inputMode="decimal" required autoFocus value={fx} onChange={(e) => setFx(e.target.value)} placeholder="0.00" className="input text-lg font-semibold" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="currency">Currency</label>
          <select
            id="currency"
            name="currency"
            value={cur}
            onChange={(e) => {
              setCur(e.target.value);
              auto.current = false;
            }}
            className="input"
          >
            {CURRENCIES.map(([c, n]) => (
              <option key={c} value={c}>{c} – {n}{c === primary ? " (main)" : ""}</option>
            ))}
          </select>
        </div>
      </div>
      {cur !== primary && <RateNote from={cur} to={primary} amount={num(fx)} />}
    </div>
  );
}
