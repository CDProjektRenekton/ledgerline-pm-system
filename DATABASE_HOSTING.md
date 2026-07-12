# Moving to a Bigger, Always-On Database

## The recommendation: self-hosted PostgreSQL on a VPS (not MySQL/XAMPP)

You gave me the choice, so here's the honest reasoning before the steps.

**Why not MySQL or XAMPP:**
- XAMPP is a **local development tool** — it's not designed or hardened to run as a public, always-on production database. Putting it "online" would mean manually managing security, uptime, and networking with none of the safety nets a real server OS gives you. For a government-facing system, that's a real risk.
- Switching to MySQL would mean rewriting `schema.sql` and most of the backend's SQL — this app uses PostgreSQL-specific features throughout (`tsvector` full-text search, generated columns, `ON CONFLICT ... DO UPDATE`, `RETURNING *`, `TIMESTAMPTZ`). That's a large, risky rewrite with a real chance of introducing new bugs, which conflicts with "don't break anything."

**Why a VPS running PostgreSQL instead:**
- **Zero code changes.** Same PostgreSQL, same `DATABASE_URL` connection string format — you're just pointing at a different server.
- **Storage is whatever you provision** — a $6–12/month VPS typically comes with 25–160GB of SSD storage, which is enormous for a project-management system's text/metadata (even hundreds of thousands of tasks would only use a few hundred MB). This is effectively "unlimited" for your use case, versus the 0.5–3GB caps on most free managed-Postgres tiers.
- **Always online** — a VPS runs 24/7 by design; that's the entire point of one.
- You (or whoever administers it) have full control: you can resize the disk later, add backups, or move providers without touching the app at all.

Any VPS provider works the same way (DigitalOcean, Linode, Vultr, Hetzner, AWS Lightsail). The steps below use DigitalOcean as a concrete example since it's well-documented and affordable (~$6/mo for 25GB), but the commands are nearly identical everywhere.

---

## Part 1 — Provision the server

1. Create a Droplet (or equivalent VPS):
   - **Image:** Ubuntu 24.04 LTS
   - **Size:** the cheapest plan is plenty to start (1GB–2GB RAM, 25GB+ disk) — you can resize later without downtime on most providers
   - **Region:** pick one close to your Render backend's region for lower latency (e.g., if Render deploys to `us-east`, pick an NYC/US-East VPS region)
   - Add your SSH key during creation

2. SSH in and install PostgreSQL 16:
   ```bash
   ssh root@YOUR_SERVER_IP

   apt update && apt install -y postgresql postgresql-contrib
   systemctl enable postgresql
   systemctl start postgresql
   ```

3. Create the database and a dedicated app user (don't use the `postgres` superuser for the app):
   ```bash
   sudo -u postgres psql -c "CREATE USER pms_app WITH PASSWORD 'CHOOSE_A_STRONG_PASSWORD_HERE';"
   sudo -u postgres psql -c "CREATE DATABASE pm_system OWNER pms_app;"
   ```

4. Allow remote connections **only from Render** (not the whole internet). Edit two files:

   `/etc/postgresql/16/main/postgresql.conf` — find and set:
   ```
   listen_addresses = '*'
   ```

   `/etc/postgresql/16/main/pg_hba.conf` — add a line at the bottom. Render's outbound IPs vary by plan; the simplest safe approach is to allow all IPs but require a password and SSL (Render encrypts connections by default when `sslmode=require` is in the URL):
   ```
   hostssl all all 0.0.0.0/0 scram-sha-256
   ```
   If your VPS provider's firewall supports it, additionally restrict port 5432 to Render's published outbound IP ranges (check Render's docs for their current IP list) for a second layer of protection.

5. Restart Postgres and open the firewall port:
   ```bash
   systemctl restart postgresql
   ufw allow 5432/tcp
   ufw allow OpenSSH
   ufw enable
   ```

6. Your new connection string is:
   ```
   postgresql://pms_app:CHOOSE_A_STRONG_PASSWORD_HERE@YOUR_SERVER_IP:5432/pm_system?sslmode=require
   ```

---

## Part 2 — Migrate all existing data (projects, accounts, tasks, history — everything)

This copies your **current live database** (wherever it's running now — Render's managed Postgres or Neon) into the new VPS database, byte-for-byte, with zero data loss.

1. From your own computer (or any machine with `pg_dump` installed — install via `apt install postgresql-client` on Linux, `brew install postgresql` on Mac), export the current database:
   ```bash
   pg_dump "YOUR_CURRENT_DATABASE_URL" --no-owner --no-privileges -F c -f pm_system_backup.dump
   ```
   Get `YOUR_CURRENT_DATABASE_URL` from your current Render/Neon dashboard's environment variables.

2. Restore that dump into the new VPS database:
   ```bash
   pg_restore --no-owner --no-privileges \
     -d "postgresql://pms_app:CHOOSE_A_STRONG_PASSWORD_HERE@YOUR_SERVER_IP:5432/pm_system?sslmode=require" \
     pm_system_backup.dump
   ```

3. Verify the data landed correctly:
   ```bash
   psql "postgresql://pms_app:CHOOSE_A_STRONG_PASSWORD_HERE@YOUR_SERVER_IP:5432/pm_system?sslmode=require" \
     -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM projects; SELECT COUNT(*) FROM tasks;"
   ```
   These counts should match what you saw on the old database.

---

## Part 3 — Point Render at the new database

1. Render dashboard → `pm-system-backend` → **Environment** tab
2. Update `DATABASE_URL` to the new VPS connection string from Part 1, step 6
3. Save — Render redeploys automatically
4. Watch the deploy logs for `✓ Schema applied` (the existing `migrate.js` will run and confirm all tables already match — since you just restored the exact same schema, this is a no-op safety check, not a rebuild)

---

## Part 4 — Keep it backed up

Since you now own the server, set up a daily automated backup (cron job on the VPS itself):

```bash
crontab -e
```
Add:
```
0 3 * * * pg_dump -U pms_app pm_system -F c -f /root/backups/pm_system_$(date +\%F).dump
```
This dumps a fresh backup every night at 3am. Periodically download these off the server (e.g., to Google Drive or S3) so you're protected even if the VPS itself is lost.

---

## Keeping Neon as a fallback

`NEON_SETUP.md` (in this same folder) is still valid if you ever want to switch back to a managed option instead of self-hosting — same zero-code-change process, just swap `DATABASE_URL` again.
