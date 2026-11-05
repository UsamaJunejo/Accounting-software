import type { Db } from "./db.ts";
import { accountStatement, accountsWithBalances, addTransaction, signedBalance, type Kind } from "./books.ts";

export type ShareRow = {
  id: number;
  account_id: number;
  account: string;
  kind: Kind;
  owner_id: number;
  owner_name: string;
  owner_business: string | null;
  user_id: number;
  user_name: string;
  user_email: string;
  can_add: boolean;
  status: "pending" | "accepted";
};

const SHARE_SELECT = `SELECT s.id, s.account_id, a.name AS account, c.kind, s.owner_id, o.name AS owner_name,
  o.business_name AS owner_business, s.user_id, u.name AS user_name, u.email AS user_email, s.can_add, s.status
  FROM shares s
  JOIN accounts a ON a.id = s.account_id
  JOIN subcategories sc ON sc.id = a.subcategory_id
  JOIN categories c ON c.id = sc.category_id
  JOIN users o ON o.id = s.owner_id
  JOIN users u ON u.id = s.user_id`;

// ---------- Owner side ----------

export async function shareAccount(d: Db, ownerId: number, accountId: number, email: string, canAdd: boolean) {
  const [acc] = await d.q("SELECT id FROM accounts WHERE id = $1 AND user_id = $2", [accountId, ownerId]);
  if (!acc) throw new Error("Account not found");
  const [u] = await d.q<{ id: number }>("SELECT id FROM users WHERE email = $1", [email.trim().toLowerCase()]);
  if (!u) throw new Error("No FinanceChachu user with that email. Ask them to sign up first, then share again.");
  if (u.id === ownerId) throw new Error("You can't share an account with yourself.");
  await d.q(
    `INSERT INTO shares (account_id, owner_id, user_id, can_add) VALUES ($1, $2, $3, $4)
     ON CONFLICT (account_id, user_id) DO UPDATE SET can_add = EXCLUDED.can_add`,
    [accountId, ownerId, u.id, canAdd],
  );
}

export function sharesOfAccount(d: Db, ownerId: number, accountId: number) {
  return d.q<ShareRow>(`${SHARE_SELECT} WHERE s.owner_id = $1 AND s.account_id = $2 ORDER BY s.id`, [ownerId, accountId]);
}

export async function removeShare(d: Db, ownerId: number, shareId: number) {
  await d.q("DELETE FROM shares WHERE id = $1 AND owner_id = $2", [shareId, ownerId]);
}

export type PendingEntry = {
  id: number;
  share_id: number;
  account_id: number;
  account: string;
  kind: Kind;
  user_name: string;
  direction: "increase" | "decrease";
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
};

/** Entries other people added to your shared accounts, waiting for you. */
export function pendingForOwner(d: Db, ownerId: number) {
  return d.q<PendingEntry>(
    `SELECT e.id, e.share_id, s.account_id, a.name AS account, c.kind, u.name AS user_name, e.direction,
            e.amount::float8 AS amount, to_char(e.date, 'YYYY-MM-DD') AS date, e.note,
            to_char(e.created_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD HH24:MI') AS created_at
     FROM shared_entries e
     JOIN shares s ON s.id = e.share_id
     JOIN accounts a ON a.id = s.account_id
     JOIN subcategories sc ON sc.id = a.subcategory_id
     JOIN categories c ON c.id = sc.category_id
     JOIN users u ON u.id = s.user_id
     WHERE s.owner_id = $1 AND e.status = 'pending'
     ORDER BY e.date, e.id`,
    [ownerId],
  );
}

/** Money comes INTO an asset/expense account to increase it, and OUT of the others. */
function flowsIn(kind: Kind, direction: "increase" | "decrease") {
  const debitNormal = kind === "asset" || kind === "expense";
  return direction === "increase" ? debitNormal : !debitNormal;
}

export async function approveSharedEntry(d: Db, ownerId: number, entryId: number, otherAccountId: number) {
  const [e] = (await pendingForOwner(d, ownerId)).filter((x) => x.id === entryId);
  if (!e) throw new Error("Entry not found or already decided");
  if (otherAccountId === e.account_id) throw new Error("Choose a different account for the other side");
  const accs = await accountsWithBalances(d, ownerId);
  const other = accs.find((a) => a.id === otherAccountId);
  if (!other) throw new Error("Choose the other account");
  const into = flowsIn(e.kind, e.direction);
  const cashLike = other.category === "Cash" || other.category === "Bank";
  // If money comes out of Cash/Bank it's a payment; into Cash/Bank is a receipt.
  const type = cashLike ? (into ? "payment" : "receipt") : "transfer";
  await d.tx(async (t) => {
    const txnId = await addTransaction(t, ownerId, {
      type,
      date: e.date,
      amount: e.amount,
      fromAccountId: into ? otherAccountId : e.account_id,
      toAccountId: into ? e.account_id : otherAccountId,
      note: [e.note, `(added by ${e.user_name})`].filter(Boolean).join(" "),
    });
    await t.q(
      "UPDATE shared_entries SET status = 'approved', transaction_id = $1, decided_at = now() WHERE id = $2",
      [txnId, entryId],
    );
  });
}

export async function rejectSharedEntry(d: Db, ownerId: number, entryId: number, remarks: string) {
  const r = await d.q(
    `UPDATE shared_entries e SET status = 'rejected', remarks = $1, decided_at = now()
     FROM shares s WHERE s.id = e.share_id AND s.owner_id = $2 AND e.id = $3 AND e.status = 'pending' RETURNING e.id`,
    [remarks || null, ownerId, entryId],
  );
  if (!r.length) throw new Error("Entry not found or already decided");
}

// ---------- Shared-with-me side ----------

export async function sharedWithMe(d: Db, userId: number) {
  const shares = await d.q<ShareRow>(`${SHARE_SELECT} WHERE s.user_id = $1 ORDER BY s.status DESC, s.id DESC`, [userId]);
  // Balance of each shared account, as the owner sees it.
  return Promise.all(
    shares.map(async (s) => {
      if (s.status !== "accepted") return { ...s, balance: 0 };
      const [b] = await d.q<{ i: number; o: number }>(
        `SELECT COALESCE(SUM(CASE WHEN to_account_id = $1 THEN amount END), 0)::float8 AS i,
                COALESCE(SUM(CASE WHEN from_account_id = $1 THEN amount END), 0)::float8 AS o
         FROM transactions WHERE deleted_at IS NULL AND (to_account_id = $1 OR from_account_id = $1)`,
        [s.account_id],
      );
      return { ...s, balance: signedBalance(s.kind, b.i, b.o) };
    }),
  );
}

export async function respondToShare(d: Db, userId: number, shareId: number, accept: boolean) {
  if (accept) await d.q("UPDATE shares SET status = 'accepted' WHERE id = $1 AND user_id = $2", [shareId, userId]);
  else await d.q("DELETE FROM shares WHERE id = $1 AND user_id = $2", [shareId, userId]);
}

async function myAcceptedShare(d: Db, userId: number, shareId: number) {
  const [s] = await d.q<ShareRow>(`${SHARE_SELECT} WHERE s.id = $1 AND s.user_id = $2 AND s.status = 'accepted'`, [
    shareId,
    userId,
  ]);
  if (!s) throw new Error("Shared account not found");
  return s;
}

/** The statement of a shared account. The owner's other account names are hidden. */
export async function sharedStatement(d: Db, userId: number, shareId: number, from: string, to: string) {
  const share = await myAcceptedShare(d, userId, shareId);
  const st = await accountStatement(d, share.owner_id, share.account_id, from, to);
  const submissions = await d.q<{
    id: number;
    direction: "increase" | "decrease";
    amount: number;
    date: string;
    note: string | null;
    status: string;
    remarks: string | null;
  }>(
    `SELECT id, direction, amount::float8 AS amount, to_char(date, 'YYYY-MM-DD') AS date, note, status, remarks
     FROM shared_entries WHERE share_id = $1 ORDER BY id DESC LIMIT 50`,
    [shareId],
  );
  return {
    share,
    opening: st.opening,
    closing: st.closing,
    lines: st.lines.map((l) => ({
      id: l.id,
      date: l.date,
      note: l.note,
      moneyIn: l.moneyIn,
      moneyOut: l.moneyOut,
      balance: l.balance,
    })),
    submissions,
  };
}

export async function submitSharedEntry(
  d: Db,
  userId: number,
  shareId: number,
  e: { direction: "increase" | "decrease"; amount: number; date: string; note?: string },
) {
  const share = await myAcceptedShare(d, userId, shareId);
  if (!share.can_add) throw new Error("You can only view this account.");
  if (!["increase", "decrease"].includes(e.direction)) throw new Error("Choose add or subtract");
  if (!Number.isSafeInteger(e.amount) || e.amount <= 0) throw new Error("Amount must be more than zero");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date) || Number.isNaN(Date.parse(e.date))) throw new Error("Invalid date");
  await d.q("INSERT INTO shared_entries (share_id, direction, amount, date, note) VALUES ($1, $2, $3, $4, $5)", [
    shareId,
    e.direction,
    e.amount,
    e.date,
    e.note || null,
  ]);
}

/** Numbers for the menu badge: invitations to answer + entries to approve. */
export async function sharingBadge(d: Db, userId: number) {
  const [r] = await d.q<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM shares WHERE user_id = $1 AND status = 'pending')::int
          + (SELECT COUNT(*) FROM shared_entries e JOIN shares s ON s.id = e.share_id
             WHERE s.owner_id = $1 AND e.status = 'pending')::int AS n`,
    [userId],
  );
  return r.n;
}
