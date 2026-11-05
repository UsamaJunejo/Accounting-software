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
- Deleted entries can be restored, and every add/edit/delete is logged.
- Ready-made Pakistani accounts: JazzCash, Easypaisa, Sales Tax Payable, Khata, etc.
- Khata with WhatsApp balance reminders.
- Works well on phones; every report prints or saves as PDF.

## Run it

Needs Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env      # then set SESSION_SECRET to a long random string
npm run dev               # http://localhost:3000
```

Production: `npm run build && npm start`. Data is kept in one SQLite file (`data/app.db`,
or `DATABASE_PATH`). Back up that file to back up everything.

Tests: `npm test`

## Code map
- `lib/books.ts`: all accounting rules (balances, reports, entries). Start here.
- `lib/db.ts`: database tables.
- `lib/auth.ts`: login sessions.
- `app/(app)/*`: the pages you see after logging in.
- `app/actions/*`: what happens when a form is submitted.
- `docs/munshibaba-reference.md`: notes on how the original app worked.

## Not built yet (next steps)
Sharing ledgers with other users (approve/reject), receipt photo attachments, multi-currency,
Urdu language, email password reset, and the 1/2/3-level display switch.
