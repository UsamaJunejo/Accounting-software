"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, Star } from "lucide-react";

export type PickerOption = { id: number; name: string; group: string; hint?: string; uses: number };

/**
 * Account chooser: type to search, most-used accounts first, then by category.
 * Works with the keyboard (↑ ↓ Enter Esc). Sends the chosen id in a hidden field.
 */
export function AccountPicker({
  name,
  options,
  value,
  placeholder = "Choose an account",
  label,
}: {
  name: string;
  options: PickerOption[];
  value?: number;
  placeholder?: string;
  label?: string;
}) {
  const [sel, setSel] = useState<number | undefined>(value);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const current = options.find((o) => o.id === sel);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const match = (o: PickerOption) => !term || o.name.toLowerCase().includes(term) || o.group.toLowerCase().includes(term) || (o.hint ?? "").toLowerCase().includes(term);
    const hits = options.filter(match);
    const out: { head?: string; o?: PickerOption }[] = [];
    if (term) {
      // Best matches first: exact name, then names starting with the text, then everything else.
      const score = (o: PickerOption) => {
        const n = o.name.toLowerCase();
        return n === term ? 0 : n.startsWith(term) ? 1 : n.includes(term) ? 2 : 3;
      };
      [...hits].sort((x, y) => score(x) - score(y) || y.uses - x.uses).forEach((o) => out.push({ o: { ...o, hint: o.hint ?? o.group } }));
      return out;
    }
    const fav = [...hits].filter((o) => o.uses > 0).sort((a, b) => b.uses - a.uses).slice(0, 6);
    if (fav.length) {
      out.push({ head: "Most used" });
      fav.forEach((o) => out.push({ o }));
    }
    let g = "";
    for (const o of hits) {
      if (o.group !== g) out.push({ head: (g = o.group) });
      out.push({ o });
    }
    return out;
  }, [q, options]);
  const choices = rows.filter((r) => r.o).map((r) => r.o!);

  useEffect(() => {
    if (!open) return;
    setHi(0);
    setTimeout(() => input.current?.focus(), 0);
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hi]);

  // Tell the rest of the page (the entry preview) what is chosen, and let it swap the two boxes.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("fc-pick", { detail: { name, id: sel } }));
  }, [name, sel]);
  useEffect(() => {
    const set = (e: Event) => {
      const d = (e as CustomEvent<{ name: string; id?: number }>).detail;
      if (d.name === name) setSel(d.id);
    };
    const ask = () => window.dispatchEvent(new CustomEvent("fc-pick", { detail: { name, id: selRef.current } }));
    window.addEventListener("fc-set", set);
    window.addEventListener("fc-ask", ask);
    return () => {
      window.removeEventListener("fc-set", set);
      window.removeEventListener("fc-ask", ask);
    };
  }, [name]);
  const selRef = useRef(sel);
  selRef.current = sel;

  const pick = (o: PickerOption) => {
    setSel(o.id);
    setOpen(false);
    setQ("");
  };

  let i = -1;
  return (
    <div ref={box} className="relative">
      <input type="hidden" name={name} value={sel ?? ""} />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen(!open)}
        className="input flex items-center justify-between gap-2 text-start"
      >
        <span className={current ? "truncate text-body" : "text-muted"}>
          {current ? current.name : placeholder}
          {current?.hint && <span className="ms-2 text-sm text-muted">{current.hint}</span>}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
      </button>
      {open && (
        <div className="absolute inset-x-0 z-30 mt-1 overflow-hidden rounded-lg border border-rule bg-white shadow-xl">
          <div className="flex items-center gap-2 border-b border-rule px-3">
            <Search className="h-4 w-4 text-muted" />
            <input
              ref={input}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setHi(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") (e.preventDefault(), setHi((h) => Math.min(h + 1, choices.length - 1)));
                else if (e.key === "ArrowUp") (e.preventDefault(), setHi((h) => Math.max(h - 1, 0)));
                else if (e.key === "Enter") {
                  e.preventDefault();
                  if (choices[hi]) pick(choices[hi]);
                } else if (e.key === "Escape") setOpen(false);
              }}
              placeholder="Search accounts…"
              className="w-full bg-transparent py-2.5 text-[15px] outline-none"
              aria-label="Search accounts"
            />
          </div>
          <ul ref={list} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {choices.length === 0 && <li className="px-3 py-3 text-sm text-muted">No account called &ldquo;{q}&rdquo;. Add it from Accounts.</li>}
            {rows.map((r, k) =>
              r.head ? (
                <li key={`h${k}`} className="flex items-center gap-1 px-3 pb-1 pt-2 text-xs font-semibold text-muted">
                  {r.head === "Most used" && <Star className="h-3 w-3" />}
                  {r.head}
                </li>
              ) : (
                (() => {
                  i++;
                  const idx = i;
                  const o = r.o!;
                  return (
                    <li
                      key={`${k}-${o.id}`}
                      data-i={idx}
                      role="option"
                      aria-selected={o.id === sel}
                      onMouseEnter={() => setHi(idx)}
                      onClick={() => pick(o)}
                      className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-[15px] ${idx === hi ? "bg-peacock-soft" : ""}`}
                    >
                      <span className="truncate">
                        {o.name}
                        {o.hint && <span className="ms-2 text-sm text-muted">{o.hint}</span>}
                      </span>
                      {o.id === sel && <Check className="h-4 w-4 text-peacock" />}
                    </li>
                  );
                })()
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
