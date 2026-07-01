# Switching to Neon (free PostgreSQL)

Neon is the recommended free Postgres alternative — serverless, generous free tier, and zero code changes needed.

## Why Neon?
- **Free tier**: 0.5 GB storage, auto-suspend when idle (no wasted compute)
- **Real Postgres 16** — identical to Render's managed Postgres, 100% compatible
- **No code changes** — just swap `DATABASE_URL`
- No row limits, no connection limits, branches for staging

## Steps

### 1. Create a Neon account + project
1. Go to https://neon.tech and sign up (free)
2. Click **New Project** → give it a name (e.g. `mwss-pms`)
3. Select region closest to your Render backend (e.g. `AWS us-east-1`)
4. Click **Create Project**

### 2. Copy the connection string
In the Neon dashboard → **Connection Details** → copy the **Connection string**. It looks like:

```
postgresql://jister:<password>@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### 3. Update Render
1. Go to your Render dashboard → select `pm-system-backend`
2. **Environment** tab → find `DATABASE_URL`
3. Paste the Neon connection string as the new value
4. Click **Save Changes** — Render will auto-restart

The backend's `npm run start` runs `node src/migrate.js` on every deploy, which creates all tables (using `IF NOT EXISTS`) on the fresh Neon database automatically. No manual SQL needed.

### 4. (Optional) Run the seed
To populate demo data on Neon, temporarily set `DATABASE_URL` in your local `.env` to the Neon connection string, then:

```bash
cd backend
node src/seed.js
```

### 5. Remove Render's managed Postgres (optional)
Once migrated, you can delete the `pm-system-db` service from Render to save on free-tier instance count.

## Supabase (alternative)
If you prefer Supabase:
1. https://supabase.com → New project
2. **Settings → Database → Connection string (URI)**
3. Use the `postgres://...` URI (not the pooler) as `DATABASE_URL`
4. Same steps as above — no code changes needed

## Current render.yaml
The `render.yaml` still references `pm-system-db` (Render's managed Postgres) as the default. After migrating to Neon, you can either:
- Remove the `databases:` section from `render.yaml` and the `DATABASE_URL` `fromDatabase` binding, replacing it with a hardcoded `DATABASE_URL` env var pointing to Neon
- Or keep both — `DATABASE_URL` is set via the environment override on Render, which takes precedence over `render.yaml`
