# Deploying Ledgerline

GitHub stores your code — it doesn't run it. To get a live URL, you push the
code to GitHub, then point a hosting platform at that repo. Below is the
quickest path (Render, free tier, no credit card), plus where to look if you'd
rather use something else.

## Part 1 — Push to GitHub

1. Create a new repo at https://github.com/new (don't initialize it with a
   README — you already have one).
2. From the `pm-system` folder:
   ```bash
   git add .
   git commit -m "Initial commit: Ledgerline PM system"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
   (`node_modules`, `.env`, and `dist` are already excluded via `.gitignore` —
   you're only pushing source code, which is what you want.)

## Part 2 — Deploy (Render)

Render can host the Postgres database, the Node API, and the static React
build all from one GitHub repo, and it auto-redeploys whenever you push.

1. Go to https://render.com and sign in with GitHub.
2. Click **New > Blueprint**, select your repo. Render will detect
   `render.yaml` at the repo root and propose three resources:
   - `pm-system-db` — a free PostgreSQL instance
   - `pm-system-backend` — the Express API (runs `npm run start`, which
     applies the schema automatically before booting — see
     `backend/src/migrate.js`)
   - `pm-system-frontend` — the built React app, served as static files
3. Click **Apply**. First deploy takes a few minutes.
4. Once `pm-system-backend` is live, copy its URL (something like
   `https://pm-system-backend-xxxx.onrender.com`).
5. Open `pm-system-frontend` → **Environment**, set:
   ```
   VITE_API_BASE = https://pm-system-backend-xxxx.onrender.com/api
   ```
   and trigger a manual redeploy (env vars only take effect on a fresh build
   for static sites).
6. On the backend service, set `CORS_ORIGIN` to your frontend's URL (e.g.
   `https://pm-system-frontend-xxxx.onrender.com`) instead of `*`, and
   redeploy, so only your frontend can call the API.
7. Seed demo data once, from your own machine, pointing at the live database:
   ```bash
   cd backend
   DATABASE_URL="<connection string from Render dashboard>" npm run seed
   ```
8. (Optional) To enable real assignment emails instead of console-only
   logging, add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and
   `FROM_EMAIL` as environment variables on the `pm-system-backend` service
   (Environment tab → Add Environment Variable), then redeploy. See
   `backend/.env.example` for a Gmail example.

Your app is now live at the frontend's `.onrender.com` URL.

**Free tier note:** Render's free web services spin down after 15 minutes of
inactivity and take ~30–60 seconds to wake back up on the next request —
fine for testing/demos, not for production traffic.

## Other hosting options

- **Railway** (railway.app) — similar one-repo, Postgres + Node setup, also
  has a generous free trial.
- **Split setup**: frontend on **Vercel** or **Netlify** (best-in-class for
  static/React builds), backend on **Render** or **Fly.io**, database on
  **Neon** or **Supabase** (both have serverless Postgres free tiers). More
  setup, but each piece is best-in-class and scales independently.
- **Self-hosting**: `docker-compose.yml` in this repo already gives you
  Postgres in a container — pair it with a VPS (DigitalOcean, Linode) running
  `docker compose up -d` plus a process manager like `pm2` for the Node app.

## What you do NOT need

- GitHub Pages — it only serves static files and can't run the Express API
  or Postgres, so it can't host this app on its own (though it *could* host
  just the frontend if you separately host the backend elsewhere and point
  `VITE_API_BASE` at it).
