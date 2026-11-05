import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listTransactions, type TxnType } from "@/lib/books";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Quote, and stop spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const p = req.nextUrl.searchParams;
  const rows = listTransactions(db(), user.id, {
    from: p.get("from") || undefined,
    to: p.get("to") || undefined,
    type: (p.get("type") as TxnType) || undefined,
    search: p.get("q") || undefined,
    limit: 100000,
  });
  const lines = [
    ["No", "Date", "Type", "From", "To", "Amount (PKR)", "Note"].map(cell).join(","),
    ...rows.map((r) => [r.id, r.date, r.type, r.from_name, r.to_name, (r.amount / 100).toFixed(2), r.note].map(cell).join(",")),
  ];
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="entries-${p.get("from") ?? "all"}-to-${p.get("to") ?? "all"}.csv"`,
    },
  });
}
