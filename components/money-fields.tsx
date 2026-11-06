"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { CURRENCIES, currencySymbol } from "@/lib/currencies";

const fmt = (n: number) => new Intl.NumberFormat("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const num = (s: string) => Number(String(s).replace(/,/g, ""));

/** Amount in the main currency, or in another currency with an exchange rate (the main amount is worked out). */
export function MoneyFields({
  amount,
  primary = "PKR",
  currency,
  foreignAmount,
  rate,
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
  const [r, setR] = useState(rate ?? "");
  const [msg, setMsg] = useState("");
  const converted = num(fx) * num(r);

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
        setR("");
        fetchRate(need);
        auto.current = true;
      } else if (!need && auto.current && curRef.current !== primary) {
        // We switched it for a foreign account that's no longer picked: back to the main currency.
        setCur(primary);
        setMsg("");
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

  async function fetchRate(c: string) {
    setMsg("Getting today's rate…");
    try {
      const res = await fetch(`/api/rate?from=${c}&to=${primary}`);
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
              if (e.target.value !== primary && !r) fetchRate(e.target.value);
              else setMsg("");
            }}
            className="input"
          >
            {CURRENCIES.map(([c, n]) => (
              <option key={c} value={c}>{c} – {n}{c === primary ? " (main)" : ""}</option>
            ))}
          </select>
        </div>
      </div>
      {cur !== primary && (
        <div className="grid items-end gap-3 rounded-md border border-rule bg-paper p-3 sm:grid-cols-[1fr_auto_1fr]">
          <div>
            <label className="label" htmlFor="rate">Rate: {primary} for 1 {cur}</label>
            <input id="rate" name="rate" inputMode="decimal" required value={r} onChange={(e) => setR(e.target.value)} className="input" />
          </div>
          <button type="button" onClick={() => fetchRate(cur)} className="btn-ghost"><RefreshCw className="h-4 w-4" />Today&apos;s rate</button>
          <div>
            <div className="label">Saved in your books as</div>
            <div className="py-2 text-lg font-bold text-ink">{converted > 0 ? `${currencySymbol(primary)} ${fmt(converted)}` : "–"}</div>
          </div>
          {msg && <p className="text-sm text-muted sm:col-span-3">{msg}</p>}
        </div>
      )}
    </div>
  );
}
