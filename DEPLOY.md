# Putting FinanceChachu online (Railway)

Railway runs the website 24/7 and keeps your data on a disk. It costs about **USD 5/month**
(Hobby plan). Everything below is done in the browser, no coding needed.

## 1. Create the project
1. Go to **https://railway.com** and sign up with your **GitHub** account.
2. Click **New Project → Deploy from GitHub repo** and choose **Accounting-software**.
   If asked, allow Railway to access the repository.
3. Open the new service, go to **Settings → Source**, and set the branch to the one that has
   this code (e.g. `main` after merging, or `ccr-4c8824ba-q4ul6t`).

Railway reads `railway.json` and builds with the `Dockerfile` automatically.

## 2. Add the secret key
In the service, open **Variables → New Variable**:

| Name | Value |
|---|---|
| `SESSION_SECRET` | a long random string (at least 40 characters). Keep it private. |

## 3. Add storage for your data (important!)
Without this, **all data is lost every time the site restarts.**
1. Right-click the service (or use the **+ / Add** menu) → **Volume**.
2. Set **Mount path** to `/data`.

## 4. Get your web address
**Settings → Networking → Generate Domain.** You'll get a link like
`financechachu-production.up.railway.app`. Open it and create your account.

Later you can connect your own domain (e.g. `financechachu.pk`) under **Settings → Networking → Custom Domain**.

## Checking it works
- `https://<your-domain>/api/health` should show `{"ok":true}`.
- If the site doesn't start, open **Deployments → View logs**.

## Backups
Your whole database is one file: `/data/app.db`. Railway can back up volumes
(**Volume → Backups**); turn on daily backups.

## Other hosts
The `Dockerfile` works on any host that runs Docker (Render, Fly.io, a VPS). Just:
set `SESSION_SECRET`, attach a persistent disk at `/data`, and expose port `3000`.
