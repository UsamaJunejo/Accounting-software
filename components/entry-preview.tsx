"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, Info } from "lucide-react";
import { isMoney, typeFor, type Kind, type Role, type TxnType } from "@/lib/kinds";

export type PreviewAccount = { id: number; name: string; kind: Kind; role: Role; balance: number };

const TYPE_NAME: Record<TxnType, string> = { payment: "Money Out", receipt: "Money In", transfer: "Transfer" };
const fmt = (n: number) => new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(n);

/** One plain sentence for how an entry changes one account. */
function line(a: PreviewAccount, up: boolean, amt: string) {
  if (isMoney(a)) return up ? `${amt} comes into ${a.name}` : `${amt} goes out of ${a.name}`;
  if (a.role === "receivable") return up ? `${a.name} will owe you ${amt} more` : `${a.name} will owe you ${amt} less`;
  if (a.role === "payable") return up ? `You will owe ${a.name} ${amt} more` : `You will owe ${a.name} ${amt} less`;
  switch (a.kind) {
    case "expense": return up ? `${amt} spent on ${a.name}` : `${a.name} spending goes down by ${amt} (refund)`;
    case "income": return up ? `${amt} earned from ${a.name}` : `${a.name} income goes down by ${amt}`;
    case "liability": return up ? `You owe ${amt} more on ${a.name}` : `You owe ${amt} less on ${a.name}`;
    case "equity": return up ? `${a.name} goes up by ${amt}` : `${a.name} goes down by ${amt}`;
    default: return up ? `${a.name} goes up by ${amt}` : `${a.name} goes down by ${amt}`;
  }
}

/**
 * Under the entry form: says in words what the entry will do, before it is saved,
 * and offers a swap when From and To were picked the wrong way round.
 */
export function EntryPreview({ accounts, tab, cur }: { accounts: PreviewAccount[]; tab: TxnType; cur: string }) {
  const [ids, setIds] = useState<{ from?: number; to?: number }>({});
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    const onPick = (e: Event) => {
      const d = (e as CustomEvent<{ name: string; id?: number }>).detail;
      if (d.name === "from" || d.name === "to") setIds((x) => ({ ...x, [d.name]: d.id }));
    };
    const onInput = (e: Event) => {
      const el = e.target as HTMLInputElement;
      if (el.name === "amount") setAmount(Number(el.value.replace(/,/g, "")) || 0);
    };
    window.addEventListener("fc-pick", onPick);
    document.addEventListener("input", onInput);
    // The pickers may have announced their first choice before we were listening.
    window.dispatchEvent(new Event("fc-ask"));
    const a = document.querySelector<HTMLInputElement>('input[name="amount"]');
    if (a) setAmount(Number(a.value.replace(/,/g, "")) || 0);
    return () => {
      window.removeEventListener("fc-pick", onPick);
      document.removeEventListener("input", onInput);
    };
  }, []);

  const from = accounts.find((a) => a.id === ids.from);
  const to = accounts.find((a) => a.id === ids.to);
  if (from && to && from.id === to.id)
    return (
      <div role="alert" className="rounded-lg border border-khata/30 bg-khata-soft px-4 py-3 text-[15px] text-khata sm:col-span-2">
        <b>From and To are both {from.name}.</b> An entry moves money between two different accounts.{" "}
        {isMoney(from) ? (
          <>
            To record money you already have,{" "}
            <a href={`/accounts/${from.id}/edit#opening`} className="font-semibold underline">add a starting balance to {from.name}</a>.
            {" "}If it came from a sale, choose Sales; if it is your own money, choose Owner Capital.
          </>
        ) : (
          "Choose the other account."
        )}
      </div>
    );
  if (!from || !to) return null;

  const amt = amount > 0 ? `${cur} ${fmt(amount)}` : "the amount";
  // Assets and expenses grow when money goes in; the others grow when it comes out.
  const grows = (a: PreviewAccount, into: boolean) => (a.kind === "asset" || a.kind === "expense" ? into : !into);
  const saved = typeFor(from, to);
  const swap = () => {
    window.dispatchEvent(new CustomEvent("fc-set", { detail: { name: "from", id: to.id } }));
    window.dispatchEvent(new CustomEvent("fc-set", { detail: { name: "to", id: from.id } }));
  };
  // A Money Out where money comes INTO cash (or the reverse) is almost always a mix-up.
  const lowMoney = isMoney(from) && amount > 0 && from.balance - Math.round(amount * 100) < 0;
  const backwards = (tab === "payment" && saved === "receipt") || (tab === "receipt" && saved === "payment");

  return (
    <div className={`rounded-lg border px-4 py-3 text-[15px] sm:col-span-2 ${backwards || lowMoney ? "border-marigold/40 bg-marigold-soft" : "border-rule bg-paper"}`} aria-live="polite">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-semibold text-ink"><Info className="h-4 w-4" />What this entry does</span>
        <button type="button" onClick={swap} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-brand hover:bg-white">
          <ArrowLeftRight className="h-4 w-4" />Swap From and To
        </button>
      </div>
      <ul className="list-disc space-y-0.5 ps-5 text-body">
        <li>{line(from, grows(from, false), amt)}</li>
        <li>{line(to, grows(to, true), amt)}</li>
      </ul>
      <p className="mt-1 text-sm text-muted">Saved as <b>{TYPE_NAME[saved]}</b>.</p>
      {lowMoney && (
        <p className="mt-1 text-sm font-semibold text-marigold">
          {from.name} only has {cur} {fmt(from.balance / 100)}, so it will go below zero.{" "}
          <a href={`/accounts/${from.id}/edit#opening`} className="underline">Add its starting balance</a> if you had money before.
        </p>
      )}
      {backwards && (
        <p className="mt-1 text-sm font-semibold text-marigold">
          {tab === "payment" ? "This looks like money coming in, not going out." : "This looks like money going out, not coming in."} Did you mean to swap From and To?
        </p>
      )}
    </div>
  );
}
