-- =========================================================
-- Task Tracking & Project Management System — Schema
-- Database: PostgreSQL
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  initials TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#1F6F78',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'contributor', -- owner | admin | contributor | viewer
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo',     -- todo | inprogress | review | done
  priority TEXT NOT NULL DEFAULT 'medium', -- low | medium | high
  assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#1F6F78',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id)
);

-- Adds the team-assignment column to a tasks table that may already exist
-- in a previously-deployed database (CREATE TABLE IF NOT EXISTS above
-- would otherwise skip it silently).
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_team_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tasks_assignee_team_id_fkey'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_assignee_team_id_fkey
      FOREIGN KEY (assignee_team_id) REFERENCES teams(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS labels (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8B8680',
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS task_labels (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attachments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  url TEXT,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL,            -- due_soon | overdue | mention | status_change | assigned
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_history (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_resets (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_verifications (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subtasks (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS target_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS project_invites (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'contributor', -- owner | admin | contributor | viewer
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_project_invites_user ON project_invites(user_id, status);

-- New columns added to existing tables (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
-- Login brute-force protection: tracks consecutive failed password attempts
-- and a temporary lockout window. Reset to 0/NULL on a successful login.
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'simple';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))) STORED;

CREATE TABLE IF NOT EXISTS project_messages (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  task_ref_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS message_mentions (
  message_id INTEGER NOT NULL REFERENCES project_messages(id) ON DELETE CASCADE,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message_id INTEGER REFERENCES project_messages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_project_messages_project ON project_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_user ON message_mentions(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_team ON tasks(assignee_team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_search ON tasks USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_task_history_task ON task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);

CREATE TABLE IF NOT EXISTS task_links (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_links_task ON task_links(task_id);

-- Role system: owner / admin / contributor / viewer. "member" was the old
-- name for what's now "contributor" (full task access, no project/member
-- administration) — rename any existing rows and update column defaults so
-- new rows default correctly on installs that already had data.
UPDATE project_members SET role = 'contributor' WHERE role = 'member';
UPDATE project_invites SET role = 'contributor' WHERE role = 'member';
ALTER TABLE project_members ALTER COLUMN role SET DEFAULT 'contributor';
ALTER TABLE project_invites ALTER COLUMN role SET DEFAULT 'contributor';

-- ─────────────────────────────────────────────────────────────────────────
-- Super Admin + per-user/system theming
-- ─────────────────────────────────────────────────────────────────────────
-- System-level super admin flag — separate from the per-project owner/admin/
-- contributor/viewer roles above. A super admin can manage every user
-- account in the system (reset passwords, deactivate/reactivate, rename,
-- change login email) and customize the system-wide default theme/colors.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- Each user's personal dashboard theme choice ('default' follows whatever
-- the super admin has set system-wide; otherwise a fixed preset name like
-- 'dark' / 'blue' / 'yellow' / 'white').
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'default';

-- Generic key/value store for system-wide settings. Currently holds a single
-- row (key = 'theme') whose value is a JSON string of the super-admin-set
-- color palette, applied to every user whose personal theme is 'default'.
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the default Super Admin account once. Login is the literal string
-- "admin" (stored in the email column — the app never validates email
-- format, so this is a safe reserved login identifier), default password
-- "admin" (bcrypt hash below), which can and should be changed after first
-- login. Idempotent: only inserts if no account with this login exists yet,
-- so this never overwrites a renamed/repurposed super admin account or
-- resets a changed password on a later deploy.
INSERT INTO users (name, email, password_hash, initials, color, is_verified, is_active, is_super_admin)
VALUES ('Super Admin', 'admin', '$2b$10$NqCnuIyOAunnCnGX6Qs21eTBNsVzZVlXkg3g/QdTvxxz9IUBQSvv6', 'SA', '#0B4F6C', true, true, true)
ON CONFLICT (email) DO NOTHING;
