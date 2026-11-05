import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountsWithBalances, KIND_LABEL, listTransactions, type TxnType } from "@/lib/books";
import { today } from "@/lib/format";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Quote, and stop spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};
const rs = (paisa: number) => (paisa / 100).toFixed(2);
const TYPE: Record<string, string> = { payment: "Money Out", receipt: "Money In", transfer: "Transfer" };

function csv(name: string, header: string[], rows: unknown[][]) {
  const body = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  // The BOM makes Excel read Urdu and other non-English text correctly.
  return new NextResponse("﻿" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
    },
  });
}

/**
 * /export                 → entries (optional from, to, type, q filters)
 * /export?what=accounts   → every account with its balance (optional date = as of)
 */
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const p = req.nextUrl.searchParams;
  const d = await db();

  if (p.get("what") === "accounts") {
    const asOf = p.get("date") || today();
    const accs = await accountsWithBalances(d, user.id, { to: asOf });
    return csv(
      `accounts-${asOf}`,
      ["Category", "Type", "Sub-category", "Account", "Mobile", "Money In", "Money Out", "Balance", "Monthly Budget", "Archived"],
      accs.map((a) => [
        a.category,
        KIND_LABEL[a.kind],
        a.subcategory,
        a.name,
        a.phone,
        rs(a.money_in),
        rs(a.money_out),
        rs(a.balance),
        a.budget_monthly ? rs(a.budget_monthly) : "",
        a.archived ? "Yes" : "No",
      ]),
    );
  }

  const [rows, accs] = await Promise.all([
    listTransactions(d, user.id, {
      from: p.get("from") || undefined,
      to: p.get("to") || undefined,
      type: (p.get("type") as TxnType) || undefined,
      search: p.get("q") || undefined,
      projectId: Number(p.get("project")) || undefined,
      limit: 100000,
    }),
    accountsWithBalances(d, user.id),
  ]);
  const where = new Map(accs.map((a) => [a.id, `${a.category} › ${a.subcategory}`]));
  return csv(
    `entries-${p.get("from") || "all"}-to-${p.get("to") || "all"}`,
    ["No", "Date", "Type", "From", "From (category)", "To", "To (category)", "Amount (PKR)", "Note", "Currency", "Foreign amount", "Rate", "Project", "Attachments", "Added on"],
    rows.map((r) => [
      r.id,
      r.date,
      TYPE[r.type] ?? r.type,
      r.from_name,
      where.get(r.from_account_id),
      r.to_name,
      where.get(r.to_account_id),
      rs(r.amount),
      r.note,
      r.currency,
      r.foreign_amount != null ? rs(r.foreign_amount) : "",
      r.rate,
      r.project,
      r.attachments || "",
      r.created_at,
    ]),
  );
}
