# MunshiBaba – Reference Notes

How the original munshibaba.com app works, written down so we can rebuild it.
Captured by looking at the live app (read-only). No real account data is recorded here.

## 1. Big picture

- A simple **ledger app**: every entry moves money **from** one account **to** another.
- Default currency **PKR**, with 148 currencies available.
- Users pick an **accounting level** (1, 2 or 3) and can switch any time.
- Old tech: ASP.NET + jQuery, one main page (`mainpage.html`) that loads each screen inside it.

## 2. Account structure (3-level system)

```
Category        →  Sub-category      →  Account
Expense         →  FOOD              →  Eating out
Cash            →  SAVINGS           →  CASH
Liabilities     →  BANK LOANS        →  Bank Loan
```

Default categories: **Assets, Bank, Cash, Equity, Expense, Income, Liabilities,
Payables, Receivables, Shared** (+ user-created ones, e.g. "Online Business").

- Level 1: only Accounts.
- Level 2: Category → Account.
- Level 3: Category → Sub-category → Account.
- Each account has a small icon.

## 3. Screens

### Top bar
Logo · "Personal Accounting System" · profile photo · notifications bell.
Profile menu: My Account, CEO Dashboard, Business Module, Sign out.

### Main menu
Dashboard · Voucher · Reports · Move Account · Settings · Share Account · Send Invitation · Support.

Right sidebar: Back, Search, Add New Category, Date Filter, Help.

### Dashboard
- Date range shown at top (filterable).
- One **tile per category** with its total balance + edit icon; "Add New Category" tile.
- Summary tiles: **Shared**, **Payments** total, **Receipts** total (clickable → history).
- Pie chart + bar chart of category totals.
- Negative balances shown in brackets, e.g. `(19,177.00)`.

### Voucher (add a transaction)
Two tabs: **PAYMENT** (money out) / **RECEIPT** (money in).

| Field | Type |
|---|---|
| Amount | number + currency dropdown (default PKR) |
| From | account dropdown |
| To | account dropdown |
| Date | date picker (defaults to today) |
| Highlight | colour picker |
| Notes | text |
| Attachment | up to 5 images/PDFs |

Buttons: Reset, Save. Below: history table
`S.No · Date · From · To · Amount · Edit · Delete · Voucher (print)`.

Foreign currency: app fetches live exchange rate, user can change it.

### View transaction (shared entries)
Amount fields, date, notes, plus **Remarks** and **Approve / Reject** buttons.

### Reports
| Report | Columns / content |
|---|---|
| Group Ledger | Tabs: My Accounts / Shared (My) / Shared (Others). `SNo · Account · Sub-category · Category · Receipts · Payments · Balance`. Sort: A–Z, Z–A, lowest/highest balance, last/first entry |
| Shared Ledger (My) | Same + Delete |
| Shared Ledger (Others) | `SNo · Account · Receipts · Payments · Balance` |
| Currency Ledger | Pick currency; `S.No · Date · Narration · Payments · Receipts · Balance · Status · Edit · Action`; page size 25–250 |
| Shared Transactions | `SNo · Date · Narration · Amount · Type · Status · Select` |
| Attachments | `SNo · Account · No. of attachments · Data size` |
| Net Worth | Totals by category / sub-category / account |
| Full Statement | Printable net-worth statement, every account with balance |
| Balance Sheet | As of a date |
| Income Statement | Income vs expense for a period |
| Deleted Transactions Log | Audit trail of deleted entries |
| Payment / Receipt History | `S.No · Date · Narration · Amount · Edit · Action` |

Reports can be shared as PDF.

### Move Account
Move an account from one Category/Sub-category to another
(dropdowns show each category with its balance).

### Settings
Language · Currency · Date format · Shared accounts · Next of kin · Add projects ·
Move accounts · Switch accounting level · Set budget of account · Download data (Excel/CSV) ·
Reset account · Save Settings.

### Share Account
Search users by name / email / cell number, share a ledger with them.
Sharing types: one-to-one, one-to-many, many-to-one (staff → boss approves), business-to-customer (khata).

### Send Invitation
Name, Email, Cell # (with country), Send.

### Support
Help (per level), FAQs, Report an Issue (text box + Send).

### Other
- **CEO Dashboard** and **Business Module**: extra business views.
- **Budget**: per account, monthly/quarterly/6-monthly/yearly, alerts when over budget.
- **Pricing**: 14-day free trial, then ~USD 1/month or yearly (save 16%).

## 4. Plan for our version

1. Sign up / login.
2. Categories → Sub-categories → Accounts (seed the defaults above).
3. Voucher: Payment / Receipt in PKR.
4. Dashboard tiles + Group Ledger + Payment/Receipt history.
5. Reports: Net Worth, Balance Sheet, Income Statement.
6. Later: sharing & approvals, budgets, attachments, multi-currency, PDF/Excel, Urdu.
