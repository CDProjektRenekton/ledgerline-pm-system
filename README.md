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
| GET    | /api/notifications/counts         | Unread counts grouped by task/project (for red badges) |
| GET    | /api/messages?projectId=ID        | Project chat history          |
| POST   | /api/messages                     | Send a chat message (body: `body`, optional `taskRefId`, `mentionUserIds[]`) |
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

- **Project chat**: sidebar → Chat — a real-time message thread per project. Reference any task with the # picker, @mention any member (autocomplete as you type), mentioned users get notified instantly (in-app, in their notification bell, and via email-style log)
- **Red notification badges**: unread counts shown on each project in the sidebar and on each task card in the Kanban board, clearing automatically when you open that task or project

- JWT authentication (register/login, bcrypt-hashed passwords) with session restore on page reload
- **Email verification on registration**: a 24-hour link is sent on sign-up; unverified users see a reminder banner with a resend option. The app remains usable while unverified (dev mode logs the link to the console instead of sending)
- **Forgot / reset password**: time-limited single-use reset link (1 hour), dev mode logs to console
- Multi-project workspace, project membership
- **Role enforcement**: owner / admin / member roles on every project. Members can't add/remove members (admin+ only). Archive/rename requires admin+. Delete requires owner. Role shown in Members panel. Owner can promote any member
- **Members**: sidebar → Members — invite by email, remove members, view roles
- **Kanban board**: To Do → In Progress → In Review → Done, drag-and-drop between columns and precise reorder within columns
- **List view**: table of all tasks with status/priority/assignee/due date
- **Calendar view**: month grid with tasks plotted on due date
- **Timeline view**: Gantt-style bars from creation to due date
- **Search**: live full-text search across task titles and descriptions (GIN index), appears inline above the board when you type in the search bar
- **Archived projects**: sidebar → Archived — restore or permanently delete. Archive button on each project in the sidebar. Members can archive; only owners can delete
- Task fields: title, description, priority, assignee (person or team), due date, labels
- **Save button for title & description**: changes to the task title and description are only written to the database (and activity trail) when you save or click away — not on every keystroke
- **Subtasks / checklist**: add, check off, and delete subtasks inside a task. Progress shown as X/Y in the field label. Completions logged to the activity trail
- **Task activity trail**: every status/priority/assignee/due-date/title/description/attachment/subtask change is logged with who did it and when, shown as a unified timeline alongside comments
- File attachments: upload/download/delete, logged to activity trail
- **Real-time sync**: Socket.io — task creates/updates/deletes/reorders, subtask changes, comments, and notifications all broadcast live
- **Notification bell**: unread badge, dropdown, mark-read / mark-all-read, real-time delivery
- **Teams**: group members, assign tasks to a whole team at once
- **Email notifications**: assignment emails (person or team), due-date reminder emails, **status-change emails** to the assignee (or whole team) whenever a task moves columns. All fall back to console logging in dev mode if SMTP isn't configured
- Delete tasks (card hover → trash, or task panel)
- Delete projects (owner-only, cascades all data)
- Quick-add tasks per column

## What's next (low-priority hardening)

- Rate limiting and security headers (`helmet`) for the API
- Avatar image uploads instead of colored initials
- Automated tests + GitHub Actions CI workflow
- Production Dockerfiles and self-hosting docs
