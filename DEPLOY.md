# Putting FinanceChachu online for free (Vercel + Supabase)

- **Supabase** stores your data (free: 500 MB).
- **Vercel** runs the website (free Hobby plan, for non-commercial use; upgrade to Pro when you charge customers).

Everything is done in the browser. Takes about 15 minutes.

## 1. Create the database (Supabase)
1. Go to **https://supabase.com** → **Start your project** → sign in with GitHub.
2. **New project**:
   - Name: `financechachu`
   - **Database password**: click *Generate a password* and **save it somewhere safe**.
   - **Region: South Asia (Mumbai)**, closest to Pakistan, so the site is fast.
   - Click **Create new project** and wait ~2 minutes.
3. Click the **Connect** button at the top of the project page.
4. Under **Transaction pooler** (port **6543**), copy the connection string. It looks like:
   `postgresql://postgres.abcdxyz:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`
5. Replace `[YOUR-PASSWORD]` with the password from step 2. This full line is your **DATABASE_URL**.
   Keep it secret: anyone with it can read your data.

You don't need to create any tables. The app creates them on first visit.

## 2. Put the website online (Vercel)
1. Go to **https://vercel.com** → **Sign Up** → **Continue with GitHub**.
2. **Add New… → Project** → find **Accounting-software** → **Import**.
3. Open **Environment Variables** and add two:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the line from step 1.5 |
   | `SESSION_SECRET` | a long random string (40+ characters). Keep it private. |

4. Click **Deploy**. After ~2 minutes you get a link like `financechachu.vercel.app`. Open it and sign up.

Vercel publishes the **main** branch as the live site. Every new change merged into `main`
goes live automatically.

## 3. Keep the free database awake
Free Supabase databases pause after **7 days** with no activity. Two things prevent this:

1. **Vercel Cron (automatic):** `vercel.json` makes Vercel visit `/api/health` every day.
   That page runs a tiny database query. Check it under Vercel → your project → **Settings → Cron Jobs**.
2. **GitHub Action (backup):** `.github/workflows/keep-alive.yml` does the same every 3 days.
   Turn it on: GitHub repo → **Settings → Secrets and variables → Actions → Variables** →
   **New repository variable**: `SITE_URL` = your Vercel link (e.g. `https://financechachu.vercel.app`).
   Test it: **Actions** tab → *Keep database awake* → **Run workflow**.

Note: GitHub turns off scheduled workflows if the repository has no commits for 60 days.
The Vercel cron keeps working regardless.

If the database ever does pause, open Supabase and click **Restore project**. No data is lost.

## Checking it works
- `https://<your-site>/api/health` shows `{"ok":true,...}`.
- Problems? Vercel → your project → **Logs**.

## Backups
The free Supabase plan has no automatic backups. Until you upgrade, download a copy
now and then from Supabase → **Database → Backups**, or use *All entries → Download*
inside the app.

## Your own domain (optional)
Vercel → project → **Settings → Domains** → add e.g. `financechachu.pk` and follow the instructions.

## Other hosts
The `Dockerfile` runs anywhere Docker runs (Railway, Render, Fly.io, a VPS). Set `DATABASE_URL`
and `SESSION_SECRET` and expose port `3000`.
