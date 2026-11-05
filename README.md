# FinanceChachu – simple accounting for Pakistani small businesses

An improved rebuild of the old MunshiBaba app. Record money in and out, keep a khata for
customers and suppliers, and see profit, balance sheet and reports. All amounts in PKR.

## What's inside

| Page | What it does |
|---|---|
| Dashboard | Cash & bank, profit, receivables/payables, category totals, charts, budgets, latest entries |
| New Entry | Money Out (payment), Money In (receipt) or Transfer, with note and highlight colour |
| Entries | Search/filter every entry, edit, delete, download as CSV (opens in Excel) |
| Accounts | Category → Sub-category → Account. Add, rename, move, archive. Click for a statement |
| Khata | Customers and suppliers with balances, one-tap entries and WhatsApp reminders |
| Reports | Profit & Loss, Balance Sheet / Net Worth, Group Ledger, Deleted entries & history |
| Settings | Profile, password, data download |

### Better than the original
- Real double-entry accounting underneath, so the Balance Sheet always balances (checked automatically).
- Money stored in paisa (whole numbers), so totals never have rounding errors.
- Runs on Postgres (Supabase), with the database locked against public API access.
- Deleted entries can be restored, and every add/edit/delete is logged.
- Ready-made Pakistani accounts: JazzCash, Easypaisa, Sales Tax Payable, Khata, etc.
- Khata with WhatsApp balance reminders.
- Works well on phones; every report prints or saves as PDF.

## Run it on your computer

Needs Node.js 22 or newer. No database setup needed: a built-in Postgres stores data in `./data/pglite`.

```bash
npm install
npm run dev               # http://localhost:3000
```

Tests: `npm test`

## Put it online
Free with **Vercel + Supabase**. Step-by-step: see **[DEPLOY.md](DEPLOY.md)**.
Includes an automatic daily "ping" so the free database never pauses.

## Code map
- `lib/books.ts`: all accounting rules (balances, reports, entries). Start here.
- `lib/db.ts`: database tables and connection (Supabase Postgres, or built-in for local use).
- `lib/auth.ts`: login sessions.
- `app/(app)/*`: the pages you see after logging in.
- `app/actions/*`: what happens when a form is submitted.
- `docs/munshibaba-reference.md`: notes on how the original app worked.

## Not built yet (next steps)
Sharing ledgers with other users (approve/reject), receipt photo attachments, multi-currency,
Urdu language, email password reset, and the 1/2/3-level display switch.
