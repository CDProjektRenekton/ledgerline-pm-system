# Ledgerline — Task Tracking & Project Management System

A full-stack Kanban-based project management system: PostgreSQL database,
Node.js/Express REST API, and a connected React (Vite) frontend.

This has been built and tested end-to-end (real Postgres, real API calls,
real frontend build) — it's not a mockup.

**Want to put this on a live URL?** See [`DEPLOYMENT.md`](./DEPLOYMENT.md)
for pushing to GitHub and deploying (Render one-click blueprint included).

```
pm-system/
├── backend/          Express API + PostgreSQL schema
│   ├── schema.sql     Database schema
│   ├── src/
│   │   ├── server.js          Entry point
│   │   ├── db/index.js        Postgres connection pool
│   │   ├── middleware/auth.js JWT auth guard
│   │   ├── routes/             auth, projects, tasks, comments, labels, notifications
│   │   ├── jobs/dueDateScheduler.js   Background due-date / overdue notifier
│   │   └── seed.js            Demo data loader
│   └── package.json
├── frontend/         React app (Vite)
│   ├── src/
│   │   ├── api.js       API client
│   │   ├── Login.jsx    Auth screen
│   │   ├── Dashboard.jsx Kanban board (drag & drop, task panel, comments)
│   │   └── App.jsx      Auth/session routing
│   └── package.json
└── docker-compose.yml  One-command PostgreSQL setup
```

## 1. Database

**Option A — Docker (recommended):**
```bash
docker compose up -d
```
This starts PostgreSQL on `localhost:5432` and automatically applies `backend/schema.sql`.

**Option B — Local PostgreSQL install:**
```bash
createdb pm_system
psql -d pm_system -f backend/schema.sql
```

## 2. Backend API

```bash
cd backend
cp .env.example .env        # edit DATABASE_URL / JWT_SECRET if needed
npm install
npm run seed                # loads demo team + sample project/tasks
npm run dev                 # starts on http://localhost:4000
```

Demo login after seeding: `jister@example.com` / `password123`
(same for `mara@example.com`, `rico@example.com`, `lia@example.com`)

### API overview

| Method | Endpoint                          | Description                  |
|--------|------------------------------------|-------------------------------|
| POST   | /api/auth/register                | Create account                |
| POST   | /api/auth/login                   | Get JWT                       |
| GET    | /api/auth/me                      | Restore session from token    |
| POST   | /api/auth/forgot-password         | Request a reset link (body: `email`) |
| POST   | /api/auth/reset-password          | Set new password (body: `token`, `newPassword`) |
| GET    | /api/projects                     | List my projects              |
| POST   | /api/projects                     | Create project                |
| DELETE | /api/projects/:id                 | Delete project (owner-only, cascades) |
| GET    | /api/projects/:id/members         | List project members          |
| POST   | /api/projects/:id/members         | Add a member (body: `userId` or `email`) |
| DELETE | /api/projects/:id/members/:userId | Remove a member (not the owner) |
| GET    | /api/tasks?projectId=ID           | List tasks for a project      |
| POST   | /api/tasks                        | Create task                   |
| PATCH  | /api/tasks/:id                    | Update task (status, etc.)    |
| DELETE | /api/tasks/:id                    | Delete task                   |
| GET    | /api/tasks/:id/history            | Full activity trail for a task |
| POST   | /api/tasks/reorder                | Reorder/move tasks (body: `projectId`, `status`, `orderedIds[]`) |
| GET    | /api/comments?taskId=ID           | List comments on a task       |
| POST   | /api/comments                     | Add comment                   |
| GET    | /api/labels?projectId=ID          | List labels                   |
| POST   | /api/labels                       | Create label                  |
| GET    | /api/notifications                | My notifications               |
| GET    | /api/notifications/unread-count   | Unread notification count     |
| PATCH  | /api/notifications/:id/read       | Mark one notification read    |
| PATCH  | /api/notifications/read-all       | Mark all notifications read   |
| GET    | /api/attachments?taskId=ID        | List attachments on a task    |
| POST   | /api/attachments (multipart)      | Upload a file (field: `file`, `taskId`) |
| DELETE | /api/attachments/:id              | Delete an attachment          |
| GET    | /api/teams?projectId=ID           | List teams (with members)     |
| POST   | /api/teams                        | Create team                   |
| DELETE | /api/teams/:id                    | Delete team                   |
| POST   | /api/teams/:id/members            | Add a member (body: `userId`) |
| DELETE | /api/teams/:id/members/:userId    | Remove a member               |

All routes except `/api/auth/*` require `Authorization: Bearer <token>`.

`POST /api/tasks` and `PATCH /api/tasks/:id` accept either `assigneeId` (a
user) or `assigneeTeamId` (a team) — setting one clears the other. Sending
`assigneeId: null` (and/or `assigneeTeamId: null`) unassigns the task.

### Real-time events (Socket.io)

Connect to the backend root (e.g. `io("http://localhost:4000")`), then:
- `socket.emit("join-project", projectId)` to subscribe to a project's room
- `socket.emit("join-user", userId)` to subscribe to your personal notification room
- Listen for `task:created`, `task:updated`, `task:deleted`, `tasks:reordered`, `comment:created`, `notification:new`

The frontend already does all of this automatically.

A background job (`dueDateScheduler.js`) runs hourly, checking for tasks due
within 24 hours or overdue (for both individual assignees and whole teams),
writes a notification row, pushes it to the user in real time, and sends a
reminder email (or logs it to the console in dev mode).

## 3. Frontend

```bash
cd frontend
cp .env.example .env        # points to the backend, defaults to localhost:4000
npm install
npm run dev                 # starts on http://localhost:5173
```

Open `http://localhost:5173`, log in with the demo account above, and you're
on a live Kanban board backed by the real database — drag cards between
columns, add tasks, comment, reassign, set due dates. Every action is a real
API call and persists in Postgres.

## What's implemented

- JWT authentication (register/login, bcrypt-hashed passwords) with session restore on page reload (`/api/auth/me`)
- **Forgot / reset password**: email a time-limited reset link (1 hour), in dev mode it's logged to the console instead of sent
- Multi-project workspace, project membership
- **Members**: sidebar → Members — invite anyone who already has an account by email, so they show up as an assignee option (this is what was missing before — assigning to yourself only happens because a brand-new project starts with just its creator as a member)
- **Kanban board**: To Do → In Progress → In Review → Done, drag-and-drop status updates, **plus precise reordering within a column** (drop directly on a card to insert before/after it)
- **List view**: sortable table of all tasks with status/priority/assignee/due date
- **Calendar view**: month grid with tasks plotted on their due date
- **Timeline view**: Gantt-style bars from creation date to due date
- Task fields: title, description, priority, assignee, due date, labels
- **Task activity trail**: every status/priority/assignee/due-date/title change is logged with who did it and when, shown as a unified timeline alongside comments in the task panel
- Task detail panel with live comments
- **File attachments**: real upload/download/delete (stored on disk, served at `/uploads/...`), logged to the activity trail
- **Real-time sync**: Socket.io — task creates/updates/deletes/reorders and new comments broadcast instantly to every connected client viewing that project
- **Notification bell**: unread badge in the top bar, dropdown list, mark-as-read / mark-all-read, and new notifications arrive live over the socket (no refresh needed)
- **Teams**: group project members into named teams (sidebar → Teams), then assign a task to a team instead of one person — every team member gets notified
- **Email notifications**: assignment emails (person or team) and due-date reminder emails (due-soon and overdue, for individuals and whole teams) via SMTP. If `SMTP_HOST` isn't configured, emails are logged to the console instead — see `backend/.env.example` for setup with Gmail or any transactional provider (Resend, SendGrid, Mailgun, Postmark)
- **Delete tasks**: from the card (hover → trash icon) or from the task detail panel
- **Delete projects**: sidebar → hover a project → trash icon. Permanently deletes the project and everything in it (tasks, comments, attachments, labels, teams). Restricted to the project's owner — other members get a 404 if they try
- Quick-add tasks per column

## What's next (ideas for future iterations)

- Role-based permissions (the `project_members.role` column exists and is now enforced for member-removal and project deletion, but not yet for finer-grained actions like editing vs. viewing)
- Search that actually filters (the search bar in the top bar is currently decorative)
- Archived projects view (`is_archived` exists on the backend via `PATCH /api/projects/:id`, but there's no UI to archive/restore or browse archived projects yet)
- Subtasks / checklists within a task
- Rate limiting and security headers (`helmet`) for the API
- Avatar image uploads instead of colored initials
- Automated tests + a GitHub Actions CI workflow
- Production deployment hardening (this repo is set up for Render via `render.yaml`, but for self-hosting you'd want a process manager, log rotation, etc.)
