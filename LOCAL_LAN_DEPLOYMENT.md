# Running MWSS PMS Locally on Your Office Network (No Cloud, No Cost)

This sets up the whole system — database, backend, and frontend — on **one machine in your office**, reachable by anyone on the same WiFi/network at an address like `http://192.168.1.50:4000`. No VPS, no monthly hosting bill, no internet exposure.

This guide is for **office-only access** (everyone connects from the same building/network). If you later need staff to reach it from home or off-site, that's a different, additional setup (a VPN or tunnel service) — ask if you get there.

---

## What you need

- One machine that can stay powered on and connected to the office network during work hours. This can be:
  - A spare desktop PC
  - An old laptop repurposed as a "server"
  - A small dedicated mini PC or Raspberry Pi 4/5 (very affordable, runs this stack fine)
  - **Avoid** using someone's daily-use laptop that gets closed/shut down — if that machine goes to sleep, the whole system goes offline for everyone.
- [Node.js 20+](https://nodejs.org) installed on that machine
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac) or Docker Engine (Linux) — used only to run PostgreSQL in a container, nothing else

---

## Step 1 — Give the server machine a fixed local IP

Otherwise its address can change after a router reboot and break everyone's bookmark.

- Log into your router's admin page (usually `192.168.1.1` or `192.168.0.1`)
- Find **DHCP Reservation** / **Static Lease** (naming varies by router brand)
- Reserve an IP for the server machine's MAC address — e.g., `192.168.1.50`

To find the machine's current IP for now:
- **Windows:** open Command Prompt → `ipconfig` → look for "IPv4 Address"
- **Mac/Linux:** open Terminal → `hostname -I` (Linux) or `ipconfig getifaddr en0` (Mac)

---

## Step 2 — Start the database

From the project folder:
```bash
docker compose up -d
```
This starts PostgreSQL 16 in the background, using the `docker-compose.yml` already in this repo. Your data is stored in a persistent Docker volume (`pm_pgdata`), so it survives restarts and reboots.

Verify it's running:
```bash
docker compose ps
```

---

## Step 3 — Configure and build

In `backend/.env` (create it if it doesn't exist):
```
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pm_system
JWT_SECRET=choose-any-long-random-string-here
JWT_EXPIRES_IN=7d
CORS_ORIGIN=*
FRONTEND_URL=http://192.168.1.50:4000
```
Replace `192.168.1.50` with whatever fixed IP you reserved in Step 1 — this is only used inside password-reset/verification emails, not for day-to-day access.

Install dependencies and build the frontend once:
```bash
cd backend && npm install
cd ../frontend && npm install && npm run build
```

Apply the database schema (safe to re-run any time, including after future updates — it only adds what's missing):
```bash
cd ../backend
node src/migrate.js
```

That's it for configuration — **do not set `VITE_API_BASE`** for this setup. Leaving it unset is intentional: the backend now automatically serves the built frontend from the same process, and the app figures out its own address from whatever URL it was opened at. This means the same build works no matter what LAN IP the server ends up with — no rebuilding if the address ever changes.

---

## Step 4 — Run the app so it survives crashes and reboots

Install [pm2](https://pm2.keymetrics.io/), a process manager that keeps Node apps running and can restart them automatically:
```bash
npm install -g pm2
```

Start the backend (which now also serves the frontend):
```bash
cd backend
pm2 start src/server.js --name mwss-pms
```

Make it start automatically whenever the machine boots:
```bash
pm2 startup
```
(This prints one command specific to your OS — copy and run it.)
```bash
pm2 save
```

Useful commands:
```bash
pm2 status          # is it running?
pm2 logs mwss-pms    # view live logs
pm2 restart mwss-pms # restart after a config change
```

---

## Step 5 — Open the firewall port

By default, most OS firewalls block inbound connections to a new port until you explicitly allow it.

**Windows:** Windows Defender Firewall → Advanced Settings → Inbound Rules → New Rule → Port → TCP → `4000` → Allow the connection

**Linux:**
```bash
sudo ufw allow 4000/tcp
```

**Mac:** System Settings → Network → Firewall → Options → allow incoming connections for Node

---

## Step 6 — Everyone connects

From any device on the same office WiFi, open a browser to:
```
http://192.168.1.50:4000
```
(using whatever fixed IP you reserved). Bookmark it, or ask your IT person to set up a friendly internal name (e.g., `pms.office.local`) pointing to that IP if your router/network supports local DNS — optional, not required.

---

## Where uploaded files live

Task attachments and profile avatars are **not** stored in the database —
they're saved as plain files on this machine's disk, at:
```
backend/uploads/
```
This folder is created automatically the first time someone uploads a
file. It's just as important as the database — losing it means every
attachment and avatar becomes a broken link, even though the task/comment
records referencing them are still intact in Postgres. Back it up
alongside the database (see below), and if you ever move the app to a new
machine, copy this folder over along with your `pg_dump`.

## Backups (still important, even locally)

A single machine has no redundancy — if its disk fails, everything is lost
unless you're backing up elsewhere. Back up **both** the database and the
uploads folder every night:

**Linux/Mac** — add to `crontab -e`:
```
0 2 * * * docker exec pm_system_db pg_dump -U postgres pm_system > /path/to/backups/pm_system_$(date +\%F).sql
0 2 * * * tar -czf /path/to/backups/uploads_$(date +\%F).tar.gz -C /path/to/pm-system/backend uploads
```

**Windows** — use Task Scheduler to run a `.bat` file nightly containing:
```
docker exec pm_system_db pg_dump -U postgres pm_system > C:\backups\pm_system_%date:~-4%-%date:~3,2%-%date:~0,2%.bat
powershell Compress-Archive -Path C:\path\to\pm-system\backend\uploads -DestinationPath C:\backups\uploads_%date:~-4%-%date:~3,2%-%date:~0,2%.zip -Force
```

Periodically copy both sets of backup files to a USB drive, another
computer, or a free-tier cloud storage folder (Google Drive, OneDrive) so
you're protected even if the server machine itself is lost or damaged.

---

## What this does and doesn't cover

- ✅ Works fully offline from the internet — everything runs on your own network
- ✅ Zero recurring cost
- ✅ All your existing features (chat, notifications, real-time updates) work exactly the same, since Socket.io works fine over a LAN
- ❌ Not reachable from outside the office network (by design, per your request) — if that changes later, that's a separate setup (VPN/tunnel), not covered here
- ❌ No automatic off-site backup — you're responsible for copying backups elsewhere periodically (see above)
