# Deploying with Podman instead of Docker

Everything in `LOCAL_LAN_DEPLOYMENT.md` still applies — the only thing
that changes is how Postgres runs. The Node backend and frontend build are
identical either way (they're not containerized in either setup; only
Postgres runs in a container).

This assumes Podman is already installed and working, as you've confirmed.

## Two things about Podman that trip people up coming from Docker

These are the two issues that most likely explain why the existing
`docker-compose.yml` "doesn't work" as-is on your Sangfor VM — not a
Podman bug, just two behavioral differences from Docker:

1. **Podman doesn't assume `docker.io` for unqualified image names.**
   `image: postgres:16` in the compose file (or `podman pull postgres:16`
   on the command line) can fail with an error like *"short-name did not
   resolve to an alias and no unqualified-search registries are
   defined"* — Docker silently assumes Docker Hub; Podman requires it to
   be explicit unless `/etc/containers/registries.conf` has
   `unqualified-search-registries` configured (commonly left commented out
   by default). **Fix: always use the fully-qualified name,
   `docker.io/library/postgres:16`**, instead of relying on
   registries.conf being set up a particular way.

2. **SELinux volume labeling.** If the VM's distro has SELinux enabled
   (common on RHEL-family/enterprise Linux, which many Sangfor VM guest
   images are built on), a bind-mounted or named volume needs a `:Z` (or
   `:z` for a volume shared between multiple containers) suffix, or
   Postgres will fail to start with a permissions error even though the
   path looks correct. Every volume flag below already includes it — it's
   harmless to leave on even if SELinux isn't enforcing.

There are two ways to run Postgres under Podman — pick one:

- **Option A — podman-compose**: reuses the existing `docker-compose.yml`
  as-is, closest to the original Docker workflow.
- **Option B — native `podman run` + systemd**: no extra tooling to
  install, most portable across different VM images, and what I'd
  recommend if Option A gives you any trouble.

---

## Option A: podman-compose (reuses docker-compose.yml)

**1. Install podman-compose**
```bash
pip3 install podman-compose
```
(If `pip3` isn't available: `sudo apt install python3-pip` on
Debian/Ubuntu-based VMs, or `sudo dnf install python3-pip` on
RHEL/openEuler-based ones, first.)

**2. Fix the image name in `docker-compose.yml`** so it doesn't hit the
unqualified-name issue above — change:
```yaml
image: postgres:16
```
to:
```yaml
image: docker.io/library/postgres:16
```

**3. Start it**, from the project's root folder:
```bash
podman-compose up -d
```

**4. Verify**
```bash
podman ps
```
You should see `pm_system_db` listed as `Up`.

Skip to **"Configure the backend"** below.

---

## Option B: Native podman commands (no extra tooling)

**1. Create a named volume** for Postgres's data, so it survives
container recreation:
```bash
podman volume create pm_pgdata
```

**2. Run the Postgres container**
```bash
podman run -d \
  --name pm_system_db \
  --restart unless-stopped \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=pm_system \
  -v pm_pgdata:/var/lib/postgresql/data:Z \
  -v ./backend/schema.sql:/docker-entrypoint-initdb.d/schema.sql:Z \
  docker.io/library/postgres:16
```
Run this from the project's root folder (so the relative
`./backend/schema.sql` path resolves correctly), or replace it with the
schema file's absolute path.

**3. Verify**
```bash
podman ps
podman logs pm_system_db
```
The log should end with something like `database system is ready to
accept connections`.

**4. Make it survive a VM reboot**, since a plain `podman run` container
won't restart itself after the whole machine reboots without a systemd
unit watching it:
```bash
mkdir -p ~/.config/systemd/user   # rootless Podman (recommended, default for a non-root user)
cd ~/.config/systemd/user
podman generate systemd --new --files --name pm_system_db
systemctl --user daemon-reload
systemctl --user enable --now container-pm_system_db.service

# So user services still start on boot even before you log in:
loginctl enable-linger $(whoami)
```

If you're running Podman as root (`podman info` shows `rootless: false`),
use the system-wide equivalent instead:
```bash
mkdir -p /etc/containers/systemd
cd /tmp && podman generate systemd --new --files --name pm_system_db
sudo mv container-pm_system_db.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now container-pm_system_db.service
```

**5. Check it worked**
```bash
systemctl --user status container-pm_system_db.service   # rootless
# or: sudo systemctl status container-pm_system_db.service   # rootful
```

---

## Configure the backend

Same as the Docker-based setup — nothing here changes based on which
container engine is running Postgres, since the app just connects to
`localhost:5432` either way. In `backend/.env`:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pm_system
```

Then continue exactly as in `LOCAL_LAN_DEPLOYMENT.md`: install
dependencies, build the frontend, run `node src/migrate.js`, and start the
Node process with `pm2` — none of that involves Podman at all, since only
Postgres runs in a container.

## Troubleshooting

- **"short-name did not resolve to an alias"** → you're using an
  unqualified image name somewhere. Use `docker.io/library/postgres:16`.
- **Postgres container exits immediately / permission denied on the data
  directory** → almost always the missing `:Z` on the volume flag (SELinux
  blocking access) — double-check both `-v` flags above have it.
- **"Error: rootless Podman not supported" or cgroup errors on
  startup** → the VM's kernel/cgroup setup may need cgroup v2 enabled;
  run `podman info --format '{{.Host.CgroupsVersion}}'` — if it prints
  `v1`, check with whoever manages the Sangfor VM template about enabling
  cgroup v2 (`systemd.unified_cgroup_hierarchy=1` kernel parameter), which
  most current Linux distros already default to.
- **Port 5432 already in use** → something else on the VM (maybe a
  previous Docker attempt, or a native Postgres install) is already
  bound to it. `sudo ss -ltnp | grep 5432` to see what, and stop it or
  change the port mapping (e.g. `-p 5433:5432` and update `DATABASE_URL`
  to match).
- **Firewall/LAN access** → identical to the Docker setup, see
  `LOCAL_LAN_DEPLOYMENT.md`'s firewall step; this is about the Node
  process's port (4000), not Postgres's, so nothing Podman-specific here.
