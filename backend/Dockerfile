# Build from the REPO ROOT context, e.g.:
#   docker compose -f docker-compose.full.yml build
# (docker-compose.full.yml already points here with the right context/dockerfile)

# ── Stage 1: build the frontend ────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
# Intentionally NOT setting VITE_API_BASE — api.js resolves its own base URL
# from window.location.origin at runtime, so this one build works no matter
# what host/port/domain it's eventually served from.
RUN npm run build

# ── Stage 2: backend runtime, serving the built frontend ───────────────────
# Mirrors the native deployment exactly: one Node process, Express serving
# frontend/dist directly (server.js checks fs.existsSync(frontendDist)).
FROM node:20-alpine
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ .
# Placed as a SIBLING of /app/backend (not inside it), matching the relative
# path server.js already expects: path.join(__dirname, "..", "..", "frontend", "dist")
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

# Uploaded files (attachments/avatars) — created here so the bind mount in
# docker-compose.full.yml has somewhere to land; overwritten by that mount
# at runtime so files persist on the host, not just inside the container.
RUN mkdir -p /app/backend/uploads

EXPOSE 4000

# "npm start" = "node src/migrate.js && node src/server.js" — every container
# start re-applies schema.sql (idempotent: CREATE TABLE/COLUMN IF NOT EXISTS)
# before booting, so the database is always up to date, including seeding
# the default Super Admin account on a brand-new database.
CMD ["npm", "run", "start"]
