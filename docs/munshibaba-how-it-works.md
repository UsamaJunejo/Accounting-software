# How MunshiBaba works — detailed reference

A complete description of munshibaba.com, written so we can rebuild or improve on it.

**How this was checked (19 Nov 2026):**
- I logged in to a real account and opened every screen.
- I read the app's own page code: about 95 screens and scripts.
- I recorded every server call while browsing, with every call that could change data blocked, so the account was not changed.
- Behaviours were confirmed against the account's existing data, so **no test entries were needed**.

The account owner's name, phone, email and real balances are left out. Example figures are made up unless marked "observed".

Words in "quotes" are the app's exact on-screen text, including its spelling mistakes (for example "RECIEPTS").

---

## Contents

1. [The idea in one minute](#1-the-idea-in-one-minute)
2. [Accounts: categories, sub-categories, accounts](#2-accounts-categories-sub-categories-accounts)
3. [The 1, 2 and 3 level systems](#3-the-1-2-and-3-level-systems)
4. [How balances are worked out (the sign rule)](#4-how-balances-are-worked-out-the-sign-rule)
5. [Screen layout (shell)](#5-screen-layout-shell)
6. [Dashboard](#6-dashboard)
7. [Adding / editing / deleting categories, sub-categories, accounts](#7-adding--editing--deleting-categories-sub-categories-accounts)
8. [Voucher (recording money)](#8-voucher-recording-money)
9. [Account ledger ("Account Activity")](#9-account-ledger-account-activity)
10. [Date filter](#10-date-filter)
11. [Sharing accounts with other people](#11-sharing-accounts-with-other-people)
12. [Notifications (the bell)](#12-notifications-the-bell)
13. [Reports](#13-reports)
14. [Budgets](#14-budgets)
15. [Move Account](#15-move-account)
16. [Settings](#16-settings)
17. [My Account (user portal): profile, billing, funds, data](#17-my-account-user-portal)
18. [Send Invitation and referrals](#18-send-invitation-and-referrals)
19. [Next of kin](#19-next-of-kin)
20. [Projects, Business Module, CEO Dashboard](#20-projects-business-module-ceo-dashboard)
21. [Sign up, log in, forgot password](#21-sign-up-log-in-forgot-password)
22. [Plans, limits and the pay-wall](#22-plans-limits-and-the-pay-wall)
23. [Support: Help, FAQs, Report an Issue](#23-support-help-faqs-report-an-issue)
24. [Quirks and problems found](#24-quirks-and-problems-found)
25. [What was not tested](#25-what-was-not-tested)
26. [Technical notes](#26-technical-notes)

---

## 1. The idea in one minute

- Everything is an **account**: cash, a bank, a person, an expense, an income, a loan.
- Every money event is a **voucher** that moves an amount **From** one account **To** another.
  - There is only one kind of movement.
  - "Payment" and "Receipt" are two labels for the same thing (see §8).
- An account's balance = money that came **in** minus money that went **out**.
  - Because every entry is from-one-to-another, all balances together always add up to **0.00**.
- Accounts are organised in up to 3 levels: **Category → Sub-category → Account**.
- You can **share** an account with another MunshiBaba user:
  - read-only, or read and write;
  - each entry the other person adds must be **approved** before it counts.
- Reports (Net Worth, Balance Sheet, Income Statement, Full Statement) are worked out from the **nature** of each category: Assets, Liabilities, Equity, Expenses or Income.

## 2. Accounts: categories, sub-categories, accounts

```
Category (level 1)    Sub-category (level 2)    Account (level 3)
BANK                  MCB                       Salary account
EXPENSE               UTILITY                   Electricity
LIABILITIES           PRIVATE LOANS             (a person's name)
```

**Every category has a nature**, one of:
- **Assets**
- **Liabilities**
- **Equity**
- **Expenses**
- **Income**

The nature decides which report a category appears in. There are also a few special categories:

| Category | What it is |
|---|---|
| Ready-made ones (Assets, Bank, Cash, Equity, Expense, Income, Liabilities) | Created at sign-up. They can be renamed or deleted like any other. The FAQ says new users get "Bank, Cash, Income, Expense & Liabilities". |
| **PAYABLES**, **RECEIVABLES** | Belong to the Business Module. Shown in their own row on the dashboard. Their **name and nature are locked** in the edit pop-up. |
| **SHARED** | A system category. It holds accounts **other people shared with you**. Level 2 = the person who shared, level 3 = their accounts. It can't be edited. |

Each category, sub-category and account has a **colour**, an **icon** and a **name**. Nothing else:
- no phone number;
- no opening-balance field;
- no currency.

## 3. The 1, 2 and 3 level systems

Each user picks one "level system". It changes how many layers you see.

| System | Top of dashboard shows | Click a tile → | Voucher drop-down groups by | Net Worth page shows |
|---|---|---|---|---|
| **3 LEVEL SYSTEM** | Categories | Sub-categories → Accounts → Ledger | "CATEGORY - SUB-CATEGORY" | Categories |
| **2 LEVEL SYSTEM** | Sub-categories (all of them, A–Z) | Accounts → Ledger | Sub-category | Sub-categories |
| **1 LEVEL SYSTEM** | Accounts | Ledger | No groups; each shown as "Account ( Sub-category )" | Accounts |

- The header always shows the system ("THREE LEVEL SYSTEM").
- The grey right rail shows how deep you are now: "LEVEL 1", "LEVEL 2" or "LEVEL 3".
- **Switching** is done in Settings → "SWITCH ACCOUNTING LEVEL" and needs **email approval** (§16). The data underneath stays the same; only the view changes.

## 4. How balances are worked out (the sign rule)

Confirmed against real data in the account:

- **Balance = total received (entries where this account is "To") − total sent (entries where it is "From").**
- There is **no flip by nature**:
  - A bank you spent from goes **negative**.
  - An expense you paid into goes **positive**.
  - A loan you borrowed from goes **negative**.
- Negative numbers on tiles are shown in brackets without the minus: `(25,000.00)`.
- In ledgers and reports they show with a minus: `-25,000.00`.
- The sum of **every** category, including SHARED, is always 0.00. The orange badge next to "DASHBOARD" shows exactly this sum.

## 5. Screen layout (shell)

The whole app is one page. Each screen is loaded into the middle by the app's own script.

**Top bar (dark):**
- Logo "munshibaba.com" and the title "PERSONAL ACCOUNTING SYSTEM".
- Profile photo. Clicking it opens a menu with:
  - name and customer number;
  - **My Account** (opens the user portal in a new tab);
  - **CEO Dashboard**;
  - **BUSINESS MODULE** (only if you have a business);
  - **Sign out**.
- **Bell** with a count. It has 3 tabs: **TRANSACTIONS**, **ACTIVITY** and **ALERTS** (§12).

**Menu row (icons with labels):**
- A live **clock and date** at the left. It ticks every second and follows the 12/24-hour setting.
- **DASHBOARD**, **VOUCHER**, **REPORTS** (drop-down), **MOVE ACCOUNT**, **SETTINGS**, **SHARE ACCOUNT**, **SEND INVITATION**, **SUPPORT** (drop-down).
- REPORTS drop-down:
  - Group Ledger
  - Shared Ledger (My)
  - Shared Ledger (Others)
  - Currency Ledger
  - Shared Transactions
  - Attachments
  - Net Worth
  - Full Statement
  - Balance Sheet
  - Income Statement
  - Deleted Transactions Log
- SUPPORT drop-down: HELP (a different slide-show for each level system), FAQs, Report an Issue.

**Grey right rail (changes per screen):**
- Level label ("LEVEL 1/2/3").
- **Back** arrow. It uses the app's own back-history, not the browser's.
- **Search**.
- **Plus**: add a category, sub-category or account, depending on the level.
- **Calendar**: date filter.
- **Help** (?).

**Every screen** has a title at top left and the level system at top right ("THREE LEVEL SYSTEM").

## 6. Dashboard

The dashboard shows (screen 1 of the 3-level system), from top to bottom:

1. **"DASHBOARD"** with an orange badge, the sum of all categories (normally 0.00).
2. **Date line**: "dd-mm-yyyy to dd-mm-yyyy".
   - With "All time", this is the date of your first entry to your last entry.
   - Otherwise it is the filter range you picked.
3. **Category tiles**, 4 per row. Each tile has:
   - the icon on a square of the category's colour;
   - the NAME in capitals;
   - the balance;
   - a **pencil** at top-right to edit.
   - Clicking the tile opens level 2.
4. An **"ADD NEW CATEGORY"** tile.
5. A divider, then the **PAYABLES** and **RECEIVABLES** tiles.
6. A divider, then three wide tiles:
   - **SHARED**: total of accounts shared with you. Opens the SHARED category.
   - **PAYMENTS**: total of all Payment vouchers. Opens "PAYMENT HISTORY".
   - **RECEIPTS**: total of all Receipt vouchers. Opens "RECEIPT HISTORY".
7. Two charts of the category balances in the category colours:
   - a **doughnut** on the left;
   - a **bar chart** on the right, with negative bars going down.
   - The chart shape can be switched between bar and doughnut.
8. The footer logo.

**More details:**
- **Search** (right rail) filters the tiles by name as you type.
- **Level 2 screen:**
  - Header shows the category name and its balance, e.g. "BANK (25,000.00)".
  - Sub-category tiles, each with a pencil.
  - A last tile **"ADD &lt;CATEGORY NAME&gt;"** (e.g. "ADD BANK").
- **Level 3 screen:**
  - Header shows the sub-category name and balance.
  - Account tiles and an **"ADD NEW ACCOUNT"** tile.
  - Clicking an account opens its ledger.
- All tile numbers follow the global date filter (§10). With a filter on, they show movement in that period, not the all-time balance.

## 7. Adding / editing / deleting categories, sub-categories, accounts

All three use the same small pop-up:

| Pop-up | Fields | Buttons |
|---|---|---|
| **ADD NEW CATEGORY** | Category Name (placeholder "Enter Level 1 Name"); Select Nature [Assets, Liabilities, Equity, Expenses, Income]; Color; Icon | Cancel, Apply |
| **EDIT CATEGORY** | Same, filled in | **Delete**, Cancel, Apply |
| **ADD NEW SUB CATEGORY** | Sub Category ("Enter Name"); Color; Icon | Cancel, Apply |
| **EDIT SUB CATEGORY** | Same | Delete, Cancel, Apply |
| **ADD NEW ACCOUNT** | Account Name ("Enter Name"); Color; Icon | Cancel, Apply |
| **EDIT ACCOUNT** | Same | Delete, Cancel, Apply |

**Colour and icon pickers:**
- **Colour**: a grid of **60 colour swatches**.
- **Icon**: a grid of about **200 icons**. Examples:
  - cards, charts and currency symbols;
  - home, hotel, car, truck, bus, property, plot, shop, bank, cash, gold;
  - utility, electric, internet, water, gas, grocery;
  - medical, school, food, child, vacation, salary, rent;
  - wife, husband, brother, sister, friend;
  - mortgage, lease, client, contract, project, charity, commission, job;
  - movie, aeroplane, gift, restaurant, saving, clothing, shoes, donation, payment, receipt.
- A new item starts as **black** with a **plus-circle** icon.

**Messages (exact):**
- Sub-category:
  - "Please Enter Sub-Category Name."
  - "Sub Category Added Successfully"
  - "Sub Category Updated"
  - "Sub Category Deleted"
  - "Sub Category not deleted; please delete all sub categories first"
- Account:
  - "Please Enter Account Name."
  - "Account Added Successfully."
  - "Account Updated"
  - "Account Deleted."
  - "Account not deleted; please delete all transactions first"

**Delete rules:**
- An **account** can only be deleted when it has **no entries**. The FAQ tells users to:
  1. set a custom date filter from their first entry to today;
  2. delete every entry one by one;
  3. then delete the account.
- A **sub-category** can only be deleted when it has no accounts.
- A **category** can only be deleted when it has no sub-categories.
- On PAYABLES and RECEIVABLES the name and nature boxes are disabled.

## 8. Voucher (recording money)

Menu **VOUCHER**. It has two tabs, **PAYMENT** (orange when active) and **RECEIPT** (dark). Both have the same form.

| Field | Details |
|---|---|
| Amount | Number box "Enter Amount". The label on its left is your base currency code (e.g. "PKR"). |
| Currency drop-down | About 150 world currencies, "CODE (Name)". Defaults to your base currency. |
| Foreign row | Appears only if you pick another currency. It shows: [code] [foreign amount] [rate]. See below. |
| **FROM** | Searchable drop-down of **all** your accounts of every type. On Payment it shows each balance "[ 1,234 ]". |
| **TO** | Same list. On Receipt, the TO list shows the balances instead. |
| DATE | Date picker, defaults to today. |
| HIGHLIGHT | Pick a row colour (see below). |
| NOTES | Free text, "Enter note here". |
| ATTACHMENT | Button with "( FIVE (5) ATTACHMENTS ALLOWED )". |
| Buttons | **PRINT** (only active when editing), **RESET**, **SAVE** (turns into **Update** when editing). |

**Payment vs Receipt:**
- Both save the same "From → To" movement.
- The only differences:
  - the stored type ("P" or "R");
  - which list it shows up in (PAYMENTS / RECEIPTS tiles and histories);
  - which drop-down shows balances.
- Per the FAQ, Payment is for paying or depositing and Receipt is for money received.

**Rules the form checks:**
- An empty date gives "Please Enter Date".
- A missing From, To or amount gives "Invalid input. Transaction Failed." and the empty fields get a red border.
- It does **not** stop **From = To**. The real data has a CASH → CASH entry.
- It does **not** check that the amount is above zero.

**Saving:**
- The same entry is stored once. The note is saved with a link to the other side:
  - In the **From** account's ledger the note reads `your note [To: <other account>]` (Payment).
  - In the **To** account's ledger it reads `[From: …]`.
  - The bracketed name is a link that opens that account's ledger.
- Success shows "Transaction Saved." or "Transaction Updated.", then the form clears.

**Foreign currency:**
- The rate comes from a stored table of world rates on the server (with a "last updated" time). It is worked out as rate = base ÷ foreign.
- Typing the base amount fills the foreign amount (base ÷ rate). Typing the foreign amount fills the base amount (foreign × rate). Both are shown to 3 decimals.
- The **rate box can be edited by hand**.
- Saved with the entry: both currency codes, the rate and the foreign amount.
- In ledgers, a foreign entry shows in green after the note: `USD 100 / 280` (amount / rate).

**Highlight:**
- 19 pastel colours (white, aquamarine, azure, almond, cornsilk, peach, grey, yellow, pink, rose, green, beige, salmon, turquoise, lavender, light blue, sky, gold).
- The whole ledger row is tinted with it.

**Attachments:**
- Picking a file **uploads it straight away**, before the entry is saved.
- **PDF** is kept as-is.
- **Images** are shrunk to at most **1000 × 1000 px**.
- **.doc, .docx, .xls, .xlsx, .txt, .ppt, .html** are refused with "File formate not supported".
- Any other file type is treated as an image.
- Maximum **5** ("Maximum Five(05) Attachments Allowed.").
- Viewer: a pop-up slide-show with ‹ › arrows. PDFs are embedded. Each attachment can be removed ("Attachment Removed.").

**History under the form:**
- "PAYMENTS HISTORY" or "RECEIPT HISTORY" shows the **last one month** of that voucher type.
- Columns: S.NO., DATE (yyyy.mm.dd), FROM, TO, AMOUNT, **EDIT** (pencil), **DELETE** (red bin), **VOUCHER** (PDF icon).
  - **Edit** loads the entry back into the same form. The note is restored by cutting at the first "[".
  - **Delete** asks "Confirm Deletion of Transaction", then shows "Transaction  Deleted" and reloads the page. The entry goes to the Deleted Transactions Log.
  - **Voucher PDF** makes an A4 "Munshi.pdf" with:
    - transaction number and date;
    - currency, plus "Currency Rates" only for foreign entries;
    - your name, phone, email and package;
    - From, To, Amount, Note;
    - its attachments.

## 9. Account ledger ("Account Activity")

Opened by clicking an account tile, or any account name inside a note or report.

**Header card:**
- Your photo, name, phone and email.
- Icons: **PDF**, **Excel**, **Share**, **Print**.
- "Print Date", "Currency: PKR", and "Transactions Per Page" [25, 50, 100, 150, 200, 250].

**Title "ACCOUNT ACTIVITY", then three boxes:**
- **ACCOUNT**: NAME and BALANCE (all-time).
- **BUDGET**: either the budget bar (§14) or "[ CURRENT ACTIVITY REPORT IS WITHOUT BUDGET ]" with a **SET BUDGET** button.
- **DATE**: FROM / TO. The default is **the current calendar month** (e.g. 01 Nov to 30 Nov).

**Table columns:**

| S.NO | DATE | NARRATION | PAYMENTS | RECIEPTS | BALANCE | STATUS | EDIT | ACTION | 📎 |
|---|---|---|---|---|---|---|---|---|---|

- **PAYMENTS** = money **out** of this account. **RECIEPTS** = money **in**.
- **BALANCE** is a running balance, oldest row first, starting from the opening balance.
- Footer rows:
  - **TOTAL**: payments and receipts in the period.
  - **OPENING**: the balance just before the period starts.
- The paperclip column opens the entry's attachments.
- A "load more" row fetches the next page when there are more entries than the page size.
- Search (rail) filters rows by keyword.

**Your own rows:** EDIT (opens the voucher) and ACTION = delete.

**Rows added by someone else on a shared account:**
- STATUS shows a people icon and EDIT is greyed out.
- **Approved** rows sit in the main table and count in the balance. If the owner allowed "Transfer", ACTION shows a **Transfer** icon (§11).
- **Not-yet-approved** rows are listed in a **separate table under the ledger**:
  - no running balance;
  - not counted in the totals;
  - ACTION = view (magnifier).

**STATUS cell:**
- A small drop-down with the entry's history: "Send/Resend", "Pending", "Rejected", "Approved".
- Each step shows who did it, the date and the time, in your date and time format.

**Share (on the ledger and every report):**
- Pop-up "CONFIRMATION FOR SHARING": **Enter User Name** + **Enter Email** + **SEND**.
- It turns the page into a PDF and **emails it** to that address.
- "Please Enter Full Name and Email Address" if a field is empty. "Email Has Been Sent Successfully." on success.
- This is different from sharing an account (§11).

**Excel:** downloads the table as "Account Ledger". **Print:** prints the table area.

## 10. Date filter

Calendar icon on the right rail. The pop-up has two options:
- **Regular**: a list of [**ALL TIME**, TODAY, THIS MONTH, **LAST 30 DAYS** (pre-selected), LAST 4 MONTHS, LAST 6 MONTHS, LAST 12 MONTHS].
  - The ledger version leaves out ALL TIME.
- **Custom**: From and To dates (greyed out until Custom is picked).
  - "Please Select Custom Date From." or "Please Select Custom Date To." if one is missing.
- Buttons: Cancel, Apply.

**The filter is global and sticky.** Once set, it applies to every dashboard level and report until you change it back to ALL TIME.

The FAQ admits this confuses people: "WHY IS DASHBOARD … NOT SHOWING ACTUAL TOTAL…" The answer given is to choose ALL TIME.

## 11. Sharing accounts with other people

**Who can share:** any user, with any other MunshiBaba user.

**Steps (menu SHARE ACCOUNT):**
1. **"USER SHARING ACCOUNT"**: search box "Serach By Name / Email / Cell Number".
   - Needs at least 4 characters ("Search string must be 4 (four) characters or more."). Press Enter.
   - Below it is "User Shared Account List ( n )", the people you already share with.
2. Pick the person, then the **category**, then the **sub-category**. These steps follow your level system.
3. **"CHOOSE ACCOUNT FOR SHARING WITH"** lists your accounts. Each row has:
   - ☐ **Share**
   - [**Read only** | **Read & Write**]
   - ☐ **Transfer Enable**
4. **Submit**. The other person gets an **email and a notification** to accept the sharing.
   - Message: "Account Sharing Activation Message Sent Successfully To; &lt;name&gt;."
   - Sharing the same account again gives "Please delete previous sharing with same account and then share it again."
   - Removing gives "Account Sharing De Activated & Deleted."

**What the permissions mean:**
- **Read only**: they can see the ledger.
- **Read & Write**: they can add entries to your account. Each one needs **your approval** before it counts.
- **Transfer Enable**: on an approved entry in a shared account, they get a **Transfer** button.
  - It opens "Select Account to transfer". They pick one of their own accounts.
  - The entry is copied into their books and marked as transferred: "Transfer Complete".
  - It can be done only once per entry; the button greys out after.

**Where shared things show up:**
- **SHARED** dashboard tile and category: Level 2 = each person who shared with you; Level 3 = their accounts; then the normal ledger.
- **Reports → Shared Ledger (My)**: accounts you have shared.
  - Columns: SNO, ACCOUNTS, SUB CATEGORY, CATEGORY, RECEIPTS, PAYMENTS, BALANCE, DELETE.
  - Delete asks "Delete Sharing; confirm!" and then shows "Account Sharing Removed".
- **Reports → Shared Ledger (Others)**: accounts others share with you, shown as "Account (Owner name)" with RECEIPTS, PAYMENTS, BALANCE. Removing works the same way.
- **Reports → Shared Transactions** ("LIST OF SHARED ENTRIES"): every entry in shared ledgers.
  - Columns: SNO, DATE, NARRATION (with the person's name), AMOUNT, TYPE, STATUS, SELECT.
  - Statuses are colour-coded: **Pending** (blue), **Seen** (dark blue), **Reject** (orange), **Approved** (green), **Deleted** (red).
  - Search, sort [Account Name A–Z / Z–A, Low / High Balance First, Latest / Oldest Entry First], date filter, "Total Entries n".
- **Balance Sheet and Full Statement** list accounts shared with you as **"CROSS SHARED"**.

**Approval life-cycle of an entry someone else makes in your account:**

| Code | Status | Meaning |
|---|---|---|
| 0 | Send / Resend | Sent to you |
| 1 | Pending / Seen | You opened it ("First Read") |
| 2 | Rejected | Not shown in your ledger |
| 3 | Approved | Joins your ledger and balance |

## 12. Notifications (the bell)

- The app checks for new notifications **every 3 seconds**. The badge shows the count; the icon looks empty at 0.
- **TRANSACTIONS** tab:
  - Entries other people made in shared accounts. Each card shows User Name, Account(s), Amount, Date and Note.
  - Each card has **ACCEPT** and **REJECT** buttons, which show "Transaction Approved" or "Transaction Rejected".
  - Opening a card marks it "Seen".
- **ACTIVITY** tab: sharing activity, such as share requests.
- **ALERTS** tab: billing alerts, e.g. "Your Invoice is Pass Due…" (sic).

## 13. Reports

**Common to most report pages:**
- The header card: photo, name, phone, email.
- PDF, Excel, Share (email PDF) and Print buttons.
- "Print Date" and "Currency".
- The global date filter.

| Report | What it shows | Period |
|---|---|---|
| **Group Ledger** | Every account in one table: SNO, ACCOUNTS, SUB CATEGORY, CATEGORY, RECEIPTS, PAYMENTS, BALANCE. Tabs MY ACCOUNTS / SHARED ACCOUNTS (MY) / SHARED ACCOUNTS (OTHERS). Sort [Account Title A–Z, Z–A, Lowest Balance, Highest Balance, Last Entry, First Entry] and search. Click a row to open its ledger. | All time |
| **Shared Ledger (My) / (Others)** | See §11. | All time |
| **Currency Ledger** | Pick a currency. Only currencies you have used appear (e.g. USD). Shows the entries made in it, with TOTAL and OPENING in **both** base and foreign currency ("TOTAL()" rows). | Filter, default this month |
| **Shared Transactions** | See §11. | Filter |
| **Attachments** | "Total No of Attachments", "Total Size of Attachments x MB", and per account: NO OF ATTACHMENTS, ATTACHMENTS DATA SIZE. Click to see that account's files. | All time |
| **Net Worth** | Today's date and a big "PKR &lt;net worth&gt;". Then DETAILS: each category (3-level), sub-category (2-level) or account (1-level) with its balance. The account version has a "Show all in black" tick box; otherwise negatives are coloured. | As of today |
| **Full Statement** | "AMOUNT PKR x", FROM/TO, and the whole tree Category → Sub-category → Account with each line's movement in the period ("DESCRIPTION / BALANCE"). Includes CROSS SHARED. The FAQ calls it "the most comprehensive report". | Filter, default this month |
| **Balance Sheet** | Left "ASSETS / BALANCE": the Assets-nature tree plus CROSS SHARED. Right "LIABILITIES + EQUITY / BALANCE": the Liabilities and Equity trees, then **NET LOSS** or **NET PROFIT**. The header "AMOUNT PKR" is a check total. The FAQ: "AMOUNT IN BALANCE SHEET MUST BE ZERO". | As of today |
| **Income Statement** | Header "NET LOSS / NET PROFIT &lt;amount&gt;". Left "INCOME / BALANCE" tree, right "EXPENSE / BALANCE" tree. | Filter, default this month |
| **Deleted Transactions Log** | Per account: SNO, ACCOUNTS, SUB CATEGORY, CATEGORY, RECEIPTS, PAYMENTS, with sort. Click to see the deleted entries with a **DELETED ON** date. **There is no restore button.** | — |
| **Payment History / Receipt History** (from the dashboard tiles) | All Payment (or Receipt) vouchers: S.NO, DATE, NARRATION, PAYMENTS (or RECEIPTS), EDIT, ACTION, TOTAL. Page size options. | Filter, default this month |

**How the totals are calculated (read from the code):**
- **Net Worth** = sum of all Assets-nature balances + sum of all Liabilities-nature balances. Liabilities you owe are negative, so this works out as assets − liabilities. That matches the FAQ: "ASSETS – LIABILITIES = NET WORTH".
- **Profit or loss** (Balance Sheet and Income Statement) = Expenses balances + Income balances.
  - Income balances are negative under the sign rule.
  - If the result is ≥ 0 it is labelled **"NET LOSS"**; otherwise **"NET PROFIT"**.

## 14. Budgets

**Where:** Settings → "SET BUDGET OF ACCOUNT", or the **SET BUDGET** button on a ledger. Screen "BUDGET SETTINGS".

**Form:**
- **ACCOUNT** (any account).
- **Amount** (labelled with the base currency).
- **EFFECTIVE From / To** dates.
- RESET, SAVE.

**Hidden in the current design** (present in the code but not visible):
- a budget type [Per Month, Per Quarter, Per Half Year, Per Full Year];
- tick boxes for which reports should show the budget (Transactions, Ledger, Net Worth, Balance Sheet, Full Statement).

**Rules and messages:**
- Budgets on the same account can't overlap: "You have already defined budget with in given parameters".
- "Budget Settings Saved." / "Budget Settings Updated." / "Invalid input. Budget Settings Failed To Saved."
- Delete asks "Delete Budget Settings; Confirm!".

**List "Budget Account":** S.NO., ACCOUNT, EFFECTIVE ("yyyy-mm-dd to yyyy-mm-dd"), AMOUNT, EDIT, DELETE.

**On the ledger,** when a budget covers today:
- **Total** = the budget amount.
- **Spent** = the account's movement in the budget period.
- **Left** = Total − Spent.
- A two-colour bar shows Spent % and Left % (with tooltips).
- A history icon opens "BUDGET HISTORY": pick a past budget to see its From/To, Left, Spent and Total.

## 15. Move Account

**Where:** menu **MOVE ACCOUNT**, or Settings.

**Steps:**
1. **"Current Position of Account"**: pick the CATEGORY (with balances, e.g. "BANK(-25,000.00)"), then the SUB-CATEGORY, then the ACCOUNT TITLE.
2. **"Move Account to New Position"**: pick the CATEGORY, then the SUB-CATEGORY.
3. Press **MOVE**.

**Result:**
- The account moves **with all its entries**. Nothing about the entries changes.
- Its nature, and so the reports it appears in, follows the new category.
- Messages: "Please select account and subcategory to move" / "Successfully Moved".

**Moving a single entry** to a different account is done by **editing** it and changing From or To (FAQ).

## 16. Settings

A list of rows that expand, and a **SAVE SETTINGS** button.

| Row | What it does |
|---|---|
| **LANGUAGE** | Only "USA (English)". |
| **CURRENCY** | Your base currency, picked from about 250 countries ("Pakistan (PKR) Pakistani rupee"). It is used as the voucher's base and the reports' "Currency:". |
| **DATE FORMAT** | Toggle "Use 24 Hours Format" (sample "1:00 PM"), plus a date format [DD-MM-YYYY, MM-DD-YYYY, YYYY-MM-DD]. Used in notifications, statuses etc. |
| **SHARED ACCOUNTS** | Shortcut to sharing. |
| **NEXT TO KIN** | See §19. |
| **ADD PROJECTS** | See §20. |
| **MOVE ACCOUNTS** | See §15. |
| **SWITCH ACCOUNTING LEVEL** | Radio buttons 1 / 2 / 3 LEVEL SYSTEM (the current one in yellow), then **Submit**. An approval **email** is sent ("Email Sent For Approval, Please Check Your Email!"). The switch happens only after you click the link in the email. With no choice: "Please Select Level to Switch". |
| **SET BUDGET OF ACCOUNT** | See §14. |
| **DOWNLOAD DATA** | Excel or CSV. Select Data [Accounts, Group Ledger, Accounts Activity] (details below). With nothing picked: "Please Select Data". |
| **GROUP LICENSE** | See §17. |
| **RESET ACCOUNT** | Warning "PLEASE DOWNLOAD DATA BEFORE DELETING YOUR ALL TRANSACTIONS AND ACCOUNTS", then **Reset**. A confirm asks "Are you sure you want to delete all transaction and accounts ?". The reset only happens after **email approval** ("Email Sent For Approval, Please Check."). |

**Download Data details:**
- Excel gives **one file "&lt;your name&gt;.xls" with 3 sheets**:
  - **Accounts**: S.NO, Account Title, Category, Sub Category Title, Opening Debit, Opening Credit, Pay Source, Budget Amount, Trans, Ledger, NetWorth, Full Statement, Balance Sheet, Budget Type.
  - **Group Ledger**: S.NO, Account Title, Payments, Receipts, Opening Debit, Opening Credit, Account Holder.
  - **Account Activity**: S.NO, Account Title, Date, Narration, Payments, Receipts, Account.
- CSV gives the chosen sheet only.

**SAVE SETTINGS** shows "Settings Updated." It saves: base country and currency, currency symbol and format, date format, time format, language, and a "show help" flag.

## 17. My Account (user portal)

Opened from the profile menu in a new tab. The portal's own menu: dashboard, **Profile**, **Data Space**, **Billing Info**, **Invitations**, **Invoices**, **Funds**.

**Profile:**
- EDIT PROFILE: Full Name, Email, Country (with calling code), Cell #, Date Of Birth, photo.
- Tick boxes next to name, email and cell, which control what others see when they search for you.
- Change Password (Enter / Confirm, at least 6 characters).
- **M-PIN** (4 digits, used for Funds).
- Messages:
  - "User Information Updated"
  - "Password not matched or enter password comprising of at least 6 (six) characters."
  - "Please Enter 4 Digit MPIN."
  - "MPIN Not Matched."
  - "MPIN Updated."

**Data Space:**
- Plan period (e.g. "01-05-2026 to 31-05-2026").
- "Total Space 100 MB, Used x MB, Available y MB".
- Consumption split into **Images** and **Data**, with a gauge.

**Billing Info:** TOTAL / PAID / UNPAID INVOICES (count and $), with lists of Paid and UnPaid invoices.

**Invoices:**
- "FUNDS AVAILABLE USD x $".
- The current invoice: INVOICE #, PACKAGE, AMOUNT, INVOICE DATE, PAYMENT DUE ON, STATUS.
- "INVOICES HISTORY": S.NO., INVOICE # (format `PAK-YYYY-0000000`), PACKAGE ("Single Per Month", "14 Days Free"), AMOUNT, INVOICE DATE, PAYMENT DUE ON, STATUS (Paid / FREE / UnPaid), PAYMENT MADE ON, INVOICE SLIP.

**Funds (a wallet inside the app):**
- Tabs **Add Funds** and **Transfer Funds**. "TOTAL FUNDS USD x $".
- Form: AMOUNT, PAYMENT METHOD (from Payment Method; JazzCash is supported), REMARKS, **M-PIN**, then RESET, ADD.
- "FUNDS HISTORY": S.NO., DATE, PAYMENT TO, AMOUNT, STATUS.
- Funds pay invoices. Referral earnings land here.

**Group License** (Settings):
- Shows Total License / Invitation Sent / License Used.
- NEW INVITATION: Name, Email, Contact No, then RESET, SAVE.
- "License Details": S.NO., DATE, NAME, EMAIL, CONTACT NO, DELETE, RE-INVITE.
- This is how one payer covers several users.

## 18. Send Invitation and referrals

**Menu SEND INVITATION ("INVITE A FRIEND"):**
- Fields: Enter User Name, Enter Email, Country, Enter Cell #, then **SEND**.
- If the email already has an account: "This email is already registered as user. Please search in settings ---> Share Account".
- Success: "Your invitation has been sent successfully."

**Reward (FAQ):** you get **20% of every payment** your invitee makes, for as long as they stay subscribed.

**My Account → Invitations** shows:
- INVITATIONS SENT
- INVITATIONS REJECTED
- ACTIVE USERS
- INVITATIONS ACCEPTED
- INVITATIONS PENDING
- IN ACTIVE SINCE 90 DAYS

Each has its own list.

## 19. Next of kin

Screen "NEXT TO KIN DATA".

**Fields:** NAME, EMAIL, CONTACT NO.

**AUTO REPLY:**
- "If you do not use the munshibaba, then munshibaba should Auto Generate the notification to the nominee according to schedule given below". Choices: **3 Months (90 Days)**, **6 Months (180 Days)**, **12 Months (365 Days)**.
- "Send email to the nominee in interval of [n] Days, and [m] Times."
- Then an **EDIT** button.

**Warning text:**
- "if no reply received, then account will be automatically closed for ever."
- "(In case of closure of account, data will be deleted and no backup will be provided)"

## 20. Projects, Business Module, CEO Dashboard

**Projects** (Settings → ADD PROJECTS):
- A box "PROJECT NAME", then RESET, SAVE.
- A list: S.NO., PROJECT NAME, EDIT, DELETE. Duplicate names are checked.
- **No screen links a project to an entry, account or report.** It is only a list of names.

**Business Module:**
- Shown in the profile menu only if you own a business.
- It opens a separate site (a restaurant / business management system) in a pop-up, passing your email and user ID in the web address.
- The PAYABLES and RECEIVABLES categories belong to it.

**CEO Dashboard** (profile menu): admin counters. Each opens a list:
- TOTAL REGISTERED USERS, EMAIL CONFIRMED, EMAIL NOT CONFIRMED;
- ACTIVE, IN-ACTIVE SINCE 90 DAYS;
- INVITED, INVITATIONS ACCEPTED, INVITATIONS PENDING;
- TOTAL PAID AMOUNT (USD);
- TOTAL ACTIVE TRANSACTIONS (and split into PAYMENT and RECEIPT);
- TOTAL ATTACHMENTS, TOTAL ATTACHMENTS IN MB;
- (14 DAYS FREE) / (MONTHLY) / (YEARLY) SUBSCRIPTION USERS.

On a normal account it shows zeros.

## 21. Sign up, log in, forgot password

**Public home page:**
- Menu: Home, About us, Features, Easy Sharing, Pricing, Contact, **Sign in / Sign up**.
- A contact form: First name, Last name, phone, email, Company, message.

**Log in:**
- "Email address / cell number" and Password; Remember Me; **FORGOT PASSWORD ?**.
- Errors:
  - "Invalid Username or Password; Try again"
  - "Please confirm your account before login; Confirmation Email has been sent to you on your Email. Thank You."
- After login the app loads your settings and level system, then opens the matching dashboard.

**Sign up:**
- Fields: Full Name, Email, Country, Cell, Password, Confirm Password, photo.
- Pick a package: **Free** / **Monthly** / **Yearly**. Card details or JazzCash for paid plans. Accept the terms.
- The price is converted to your local currency based on your location.
- Messages:
  - "Please Enter Full Name"
  - "Please Enter Valid Email"
  - "Please Enter Cell Number"
  - "Please Enter Valid Email or Cell Number With At Least 10(Ten) Digits."
  - "Please Enter Password Comprising Of At Least 6 (Six) Characters."
  - "Please Select Your Package."
  - "You are already registred; Please Login"
  - "User Registered"
- A **confirmation email** must be clicked before the first login.

**Forgot password:** enter your email, then Submit. A reset link is emailed.

## 22. Plans, limits and the pay-wall

**Plans (public pricing):**

| Plan | Price | Data | Notes |
|---|---|---|---|
| Free | USD 0 | 25 MB | 14 days |
| Personal, monthly | **USD 1 / month** | 100 MB / month | "Perform almost 200,000 Transactions", Download Data, Reset Account, Next to kin |
| Personal, yearly | **USD 10 / year** | — | "Save 16%" |

- The page notes the charge is the local-currency equivalent of USD 1.
- In-app pop-ups offer "Single User Per Month US $ 1" and "Single User Per Year US $ 10".

**Storage used** = data bytes + attachment bytes, compared with the MB purchased.

**Two triggers lock the app:**
1. Used ≥ purchased gives "Sorry ! Your data limit is exceeded. Please Recharge your Data to Continue using our Services."
2. Today ≥ the invoice due date gives "Sorry ! Your Invoice is Past Due. Please Pay to Continue using our Services."

**When locked:**
- **VOUCHER, REPORTS and SHARE ACCOUNT** stop working and open the pay pop-up (PAY NOW / CANCEL) instead.
- A new unpaid invoice is created automatically.
- The dashboard and ledgers can still be viewed.

## 23. Support: Help, FAQs, Report an Issue

- **HELP**:
  - a picture slide-show for the user's level system, with numbered labels on a dashboard screenshot;
  - also an "Edit / Payment / Move / Report / Setting" walkthrough in the portal.
- **FAQs** ("FREQUENTLY ASKED QUESTIONS"): about 29 step-by-step answers covering:
  - categories, sub-categories and accounts: creating, deleting, "why account is not deleted";
  - the 1, 2 and 3 level systems and how to switch;
  - payments vs receipts, the dashboard and the voucher;
  - moving an account, sharing an account, sending an invitation;
  - each report and "cross shared";
  - foreign currency;
  - moving an entry to another account.
  - Much of §6–§16 matches it.
- **Report an Issue**: one text box "Please enter your issue here." and **SEND**.

## 24. Quirks and problems found

These matter if we want to do better:

1. **Same numbers, opposite labels.** In the account ledger, "PAYMENTS" = money out and "RECIEPTS" = money in. In the **Group Ledger**, "RECEIPTS" = money **out** and "PAYMENTS" = money **in**. This was confirmed against real data:
   - A cash account showed "receipts 50,000, payments 30,000, balance −20,000" (figures changed here), so balance = payments − receipts there.
2. **From = To is allowed** (a real CASH → CASH entry exists). Zero or negative amounts are not checked in the form.
3. **No opening-balance field.** A starting balance has to be entered as a voucher, e.g. from an Equity account.
4. **Signs never flip.**
   - Income and liabilities show as negative and expenses as positive.
   - "NET LOSS" is the label for a positive Expenses + Income total.
   - This is mathematically consistent but confusing for non-accountants.
5. **The date filter is global and sticky.** Totals change everywhere, and the FAQ has an entry about "wrong figures".
6. **Attachments upload before the entry is saved.** If the user then cancels, the files stay on the server, counted against their storage.
7. **Notes containing "[" or an apostrophe** can break. Edit cuts the note at "[". The data is sent as hand-built text, so a ' can break saving (not tested).
8. **Deleting an account** means deleting every entry one by one. There is no bulk delete or archive.
9. **Deleted entries cannot be restored** (log only).
10. **Projects do nothing** (not linked to anything).
11. **Notifications poll every 3 seconds**, which is heavy on a phone.
12. **Switching level or resetting the account needs an email round-trip.**
13. Some hidden budget options (type, which reports show it) exist in the code but not on screen.
14. Many spelling mistakes in the interface ("RECIEPTS", "Serach", "formate", "registred", "Pass Due", "Kindly Play").
15. **Sharing is heavy:** search for a user (min 4 characters), then category, then sub-category, then the account, then the receiver must accept by email, then every entry needs approval.

## 25. What was not tested

To keep the account unchanged, these were read from the code but **not actually carried out**:
- saving, editing or deleting an entry;
- uploading an attachment;
- switching level and resetting the account (both email-gated);
- sharing an account and approving an entry;
- moving an account and saving a budget;
- buying a plan and adding funds.

Their behaviour above comes from the app's own scripts and messages. These were **not checked at all**:
- what the server does with a zero or negative amount;
- whether an apostrophe in a note fails.

## 26. Technical notes

- **Stack:** ASP.NET web services (`Accounts.asmx`, `Users.asmx`, `Settings.asmx`) returning JSON. jQuery front end, Bootstrap, Chart.js, select2 drop-downs, html2pdf / jsPDF for PDFs.
- **Single page:** `mainpage.html` loads each screen into the middle area. The "Back" button is the app's own history.
- **IDs:** every record is a GUID. An entry has one ID ("Lid"), a type P/R, both account IDs, two notes (source side and target side), a highlight colour, an attachment ID list, and currency fields (Currency1, Currency2, Rate, Amount2).
- **Settings and session** (user ID, level, date filter, settings) live in the browser's session storage.
- **About 150 server functions**, for example:
  - `addTransaction`, `deleteLedgerbyID`
  - `getLedgerbyID2_forShareing_Paging`
  - `loadCat` / `loadCatFilter` / `loadCatbyID` / `loadAccountsbyID`
  - `getWorth` / `getWorth_DateFilter`
  - `getCashBankNewUI`
  - `InsertBudget` / `BudgetCheck`
  - `UpdateAccountSubCat`
  - `SendEmailShareAccountMulti`
  - `ReadTranscation` (approve / reject)
  - `UpdateTransferStatus`
  - `AddSwitchLevel`, `ResetRequest`
