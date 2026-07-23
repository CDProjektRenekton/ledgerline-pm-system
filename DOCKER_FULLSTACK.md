# Full-Stack Docker Compose (Database + Backend + Frontend)

This runs the **entire app in Docker** — Postgres, the backend API, and the
built frontend — with one command. It's an additional option alongside the
existing `docker-compose.yml` (Postgres-only, for the native Node/pm2 setup
in `LOCAL_LAN_DEPLOYMENT.md`) and the Podman setup in
`PODMAN_DEPLOYMENT.md`. Nothing about those was changed; use whichever fits
how you want to run things. Just don't run this alongside them on the same
machine at the same time — they'd fight over ports 4000/5432.

---

## Start everything

From the repo root, with Docker Desktop running:

```bash
docker compose -f docker-compose.full.yml up -d --build
```

That's the whole setup. This one command:
1. Builds the frontend
2. Installs the backend
3. Starts Postgres and waits for it to be healthy
4. Applies the database schema and seeds the default Super Admin account
5. Starts serving the app

Open **http://localhost:4000** and log in with the default Super Admin
account — login `admin`, password `admin` (change it from your profile
menu right after logging in).

---

## Configuration — already filled in

All settings live in the **`.env`** file at the repo root. It already ships
with working defaults (including a random `JWT_SECRET`), so you don't need
to touch it before your first run. Open it any time you want to change:

- The Postgres username/password/database name
- The port on your machine (`APP_PORT`, if 4000 is already taken)
- `FRONTEND_URL` (only used inside email links — update this if you set up
  LAN or internet access later)
- Email delivery (`APPS_SCRIPT_EMAIL_URL` / SMTP) — leave blank to just log
  emails to the console, which is fine for local use

After editing `.env`, re-run:
```bash
docker compose -f docker-compose.full.yml up -d --build
```

> **Security note:** the `JWT_SECRET` shipped in `.env` is a real random
> value so things work immediately, but treat it like any other secret —
> rotate it before exposing this app beyond your own machine/office network.

This file is separate from `backend/.env` (used only by the native/Podman
path) — the two don't interact with each other.

---

## Where your data lives

- **Database** — inside a Docker-managed volume (`pm_pgdata`). Survives
  container restarts/rebuilds; only removed if you explicitly delete it
  (see "Starting over" below).
- **Uploaded files** (attachments, avatars) — on your own machine's disk, at
  `pm-system/backend/uploads/`, the same path the native deployment uses.
  This is a live bind mount, not something locked inside the container — you
  can browse/back it up directly.

### Backups
```bash
docker exec pm_system_db pg_dump -U postgres pm_system > backup_$(date +%F).sql
tar -czf uploads_backup_$(date +%F).tar.gz backend/uploads
```

---

## Everyday commands

```bash
# View logs (both containers)
docker compose -f docker-compose.full.yml logs -f

# View just the app's logs
docker compose -f docker-compose.full.yml logs -f app

# Stop everything (keeps your data)
docker compose -f docker-compose.full.yml stop

# Start it back up
docker compose -f docker-compose.full.yml start

# Rebuild after pulling new code
docker compose -f docker-compose.full.yml up -d --build
```

## Starting over (deletes all data — careful)
```bash
docker compose -f docker-compose.full.yml down -v
rm -rf backend/uploads
```

---

## LAN / internet access

Same idea as the native setup: reserve a fixed local IP for this machine,
open port `APP_PORT` (default 4000) in your firewall, update `FRONTEND_URL`
in `.env`, then rebuild. See `LOCAL_LAN_DEPLOYMENT.md` Steps 1, 5, and 6 for
the exact firewall/router steps — they apply the same way here.

---

## Why one "app" container instead of separate frontend/backend containers

The backend already serves the built frontend directly as a single Node
process (`server.js` checks for `frontend/dist` and serves it) — this is
the same architecture the native and Podman deployments already use. The
Docker image mirrors that exactly via a multi-stage build (frontend gets
built in stage 1, then its output is copied next to the backend in stage
2), rather than introducing a separate nginx container and reverse-proxy
config that the rest of the project doesn't otherwise use. If you later
want to scale the frontend and backend independently, that's a reasonable
next step, but isn't necessary for a single-office deployment like this one.
