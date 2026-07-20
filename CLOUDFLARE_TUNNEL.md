# Expose the local server to the internet with Cloudflare Tunnel

This lets anyone with a link reach the app from anywhere — while Postgres
and `backend/uploads/` stay exactly where they are, on this machine's
disk. Cloudflare Tunnel is a pure pass-through: it forwards HTTP requests
from the internet to `localhost:4000` in real time and forwards the
responses back. It never stores or copies your data — nothing is "saved"
on Cloudflare's side. Every task, comment, and uploaded file is written
only to your local Postgres container and your local `backend/uploads/`
folder, same as the LAN-only setup in `LOCAL_LAN_DEPLOYMENT.md`.

Also, unlike the LAN setup's firewall step, **you don't open any inbound
port for this**. `cloudflared` only makes an *outbound* connection from
your server out to Cloudflare — nothing has to be forwarded in from the
outside, which is both simpler and more secure than exposing port 4000
directly. You can leave that port closed to the internet entirely; office
LAN access on `http://<lan-ip>:4000` can keep working side by side if you
still want it.

There are two ways to do this — pick one:

- **Option A — Quick Tunnel**: no Cloudflare account, no domain, one
  command. Gives you a random `https://something-random.trycloudflare.com`
  link that **changes every time you restart it**. Good for a quick test
  today, not for a link you'll share long-term.
- **Option B — Named Tunnel** (recommended): needs a domain on Cloudflare
  (free to add one, even a cheap one you buy just for this), but gives you
  a permanent link like `https://pms.yourdomain.com` that survives
  restarts and reboots.

---

## Option A: Quick Tunnel (fastest, temporary link)

**1. Install cloudflared**

- Windows: download the `.msi` from
  https://github.com/cloudflare/cloudflared/releases/latest and run it.
- Mac: `brew install cloudflared`
- Linux (Debian/Ubuntu):
  ```bash
  curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
  sudo dpkg -i cloudflared.deb
  ```

**2. Make sure the app is already running** (from `LOCAL_LAN_DEPLOYMENT.md`
   — `pm2 start src/server.js --name mwss-pms` should show it online).

**3. Start the tunnel**
```bash
cloudflared tunnel --url http://localhost:4000
```
Cloudflared prints a line like:
```
https://random-words-here.trycloudflare.com
```
That's the link — share it with anyone. Leave this command running (or
run it with `pm2 start "cloudflared tunnel --url http://localhost:4000" --name cf-tunnel`
so it survives closing the terminal and restarts on reboot alongside the
app itself).

**Downside:** the `trycloudflare.com` address is randomly generated fresh
every time this command starts, so it's unusable as a permanent
bookmark/link. Move to Option B once you're happy with the setup.

---

## Option B: Named Tunnel with your own domain (permanent link)

**1. Get a domain onto Cloudflare (skip if you already have one there)**

You don't need to buy a new domain if you already own one — just point
its nameservers at Cloudflare (free plan is enough):
1. Sign up at https://dash.cloudflare.com (free).
2. **Add a site** → enter your domain → choose the **Free** plan.
3. Cloudflare shows you two nameservers (e.g. `aida.ns.cloudflare.com`).
   Go to wherever you registered the domain and replace its nameservers
   with those two. This can take anywhere from a few minutes to ~24 hours
   to propagate.

If you don't have a domain at all, buying one (e.g. via Cloudflare
Registrar, Namecheap, or Google Domains) costs roughly $10–15/year — cheap
insurance for a stable link everyone bookmarks.

**2. Install cloudflared** (same as Option A, step 1).

**3. Log in and create the tunnel**
```bash
cloudflared tunnel login
```
This opens a browser to pick which domain to authorize — choose the one
you just added.

```bash
cloudflared tunnel create mwss-pms
```
This prints a **Tunnel ID** and saves a credentials file (typically at
`~/.cloudflared/<tunnel-id>.json` on Mac/Linux, or
`C:\Users\<you>\.cloudflared\<tunnel-id>.json` on Windows). Note the
Tunnel ID — you'll need it next.

**4. Create the config file**

Create `~/.cloudflared/config.yml` (same folder as the credentials file)
with:
```yaml
tunnel: <paste-your-tunnel-id-here>
credentials-file: /home/youruser/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: pms.yourdomain.com
    service: http://localhost:4000
  - service: http_status:404
```
Replace `pms.yourdomain.com` with whatever subdomain you want people to
use, and fix the credentials-file path for your OS
(`C:\Users\you\.cloudflared\<tunnel-id>.json` on Windows).

**5. Point the DNS record at the tunnel**
```bash
cloudflared tunnel route dns mwss-pms pms.yourdomain.com
```
This creates the DNS record in Cloudflare automatically — no manual DNS
dashboard editing needed.

**6. Run it as a background service (survives reboots)**

- **Linux:**
  ```bash
  sudo cloudflared service install
  sudo systemctl start cloudflared
  sudo systemctl enable cloudflared
  ```
- **Windows** (run as Administrator):
  ```
  cloudflared service install
  ```
  This registers and starts a Windows service automatically.
- **Mac:** cloudflared doesn't have a one-line service installer here —
  easiest is `pm2 start "cloudflared tunnel run mwss-pms" --name cf-tunnel`
  alongside the app (see `pm2 save` in `LOCAL_LAN_DEPLOYMENT.md`).

**7. Visit `https://pms.yourdomain.com`** — Cloudflare issues the HTTPS
certificate automatically, so this is secure (padlock) by default with no
extra setup.

---

## Update the app's `.env` for the public link

Task-assignment, verification, and password-reset emails build their
links from `FRONTEND_URL` — point it at the public address so those links
work for anyone, not just people on your LAN:

```
FRONTEND_URL=https://pms.yourdomain.com
CORS_ORIGIN=https://pms.yourdomain.com
```

(If you want *both* the LAN address and the public one to work
simultaneously, set `CORS_ORIGIN=*` instead of a single origin.)

Restart the app after editing `.env`:
```bash
pm2 restart mwss-pms
```

## A word on access control

The app already requires login (email/password + the verification/roles
system already built in), so a public link isn't the same as a public
*account* — people still can't do anything without valid credentials for
a project they've been invited to. That said, since this is now reachable
by anyone on the internet (not just your office WiFi), it's worth adding
one more layer if this handles sensitive regulatory data:

- **Cloudflare Access** (free for small teams, in the same dashboard under
  **Zero Trust → Access → Applications**): require people to verify their
  @your-office-domain email (or a specific allow-list of emails) via a
  one-time code *before* they even reach the login page. This blocks
  random internet traffic from hitting the app at all, while still
  letting your actual staff in from anywhere.

## Checking it's working

- `cloudflared tunnel info mwss-pms` shows connection status.
- Visiting the link from a phone on mobile data (not your office WiFi)
  confirms it's truly reachable from outside your network.
- The database and uploads are still 100% local — verify by checking
  `docker ps` (Postgres container still running locally) and
  `ls backend/uploads/` (files still there) on the server machine; nothing
  about this setup changes where that data lives.
