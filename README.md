# FinanceChachu – simple accounting for Pakistani small businesses

An improved rebuild of the old MunshiBaba app. Record money in and out, keep a khata for
customers and suppliers, and see profit, balance sheet and reports. All amounts in PKR.

## What's inside

| Page | What it does |
|---|---|
| Dashboard | Cash & bank, profit, receivables/payables, category totals, charts, budgets, latest entries |
| New Entry | Money Out / Money In / Transfer, in PKR or another currency (with rate), project tag, highlight, up to 5 bill photos/PDFs |
| Entries | Search/filter (date, type, project), edit, delete, download for Excel |
| Accounts | Category → Sub-category → Account (or simpler 1- or 2-level views). Statement per account, sharing |
| Khata | Customers and suppliers, one-tap udhaar/payment entries, WhatsApp reminders |
| Invoices | Bills with items, discount and GST; print/PDF; customer link on WhatsApp; optional posting to books |
| Shared | Accounts others shared with you; entries waiting for your approval |
| Reports | Profit & Loss, Balance Sheet, Group Ledger, Projects, Currency Ledger, Attachments, Deleted entries |
| Settings | Profile, address/NTN, password, recovery code, view level, next of kin, invite, downloads |
| Admin | (First user) search users, reset a password to a temporary one, make admins |

Also: English / اردو switch, "Forgot password" with a recovery code, login limits, Privacy & Terms pages.

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

## Not built yet
Email-based password reset (needs an email account), paid plans, SMS reminders, stock tracking,
and full Urdu for every page (main pages are translated; the rest stays in English).
