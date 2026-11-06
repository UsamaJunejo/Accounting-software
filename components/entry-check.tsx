"use client";

import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { parseAmount } from "@/lib/kinds";

/**
 * Checks the entry form when Save is tapped, before anything is sent: a wrong amount or a
 * missing account is pointed out right there, and nothing the person typed is lost.
 */
export function EntryCheck({ formId }: { formId: string }) {
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest("button");
      const form = document.getElementById(formId) as HTMLFormElement | null;
      if (!btn || !form || btn.form !== form || btn.type !== "submit" || btn.hasAttribute("formnovalidate")) return;
      const field = (n: string) => form.elements.namedItem(n) as HTMLInputElement | null;
      const problems: [string, HTMLElement | null][] = [];
      const amountEl = field("amount") ?? field("foreign_amount");
      const raw = amountEl?.value.trim() ?? "";
      const amt = parseAmount(raw);
      if (!raw) problems.push(["Type the amount.", amountEl]);
      else if (Number.isNaN(amt)) problems.push([`"${raw}" isn't an amount. Use numbers only, e.g. 1500 or 1,500.50.`, amountEl]);
      else if (amt <= 0) problems.push(["The amount must be more than zero.", amountEl]);
      else if (amt > 100_00_00_000_00) problems.push(["That amount is over 100 crore. Please check for an extra zero.", amountEl]);
      const box = (n: string) => form.querySelector<HTMLElement>(`div.relative:has(> input[type=hidden][name="${n}"]) > button`);
      const from = field("from")?.value, to = field("to")?.value;
      if (!from) problems.push(["Choose where the money came FROM.", box("from")]);
      if (!to) problems.push(["Choose where the money went TO.", box("to")]);
      if (from && to && from === to) problems.push(["From and To are the same account. Choose two different accounts.", box("to")]);
      const date = field("date")?.value ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) problems.push(["Choose the date.", field("date")]);
      if (!problems.length) return setMsg("");
      e.preventDefault();
      e.stopPropagation();
      setMsg(problems.map((p) => p[0]).join(" "));
      const first = problems[0][1];
      first?.scrollIntoView({ block: "center", behavior: "smooth" });
      first?.focus({ preventScroll: true });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [formId]);

  if (!msg) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-khata/30 bg-khata-soft px-4 py-3 text-[15px] font-semibold text-khata sm:col-span-2">
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
      <span>{msg}</span>
    </div>
  );
}
