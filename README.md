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
| GET    | /api/projects                     | List my projects              |
| POST   | /api/projects                     | Create project                |
| GET    | /api/projects/:id/members         | List project members          |
| GET    | /api/tasks?projectId=ID           | List tasks for a project      |
| POST   | /api/tasks                        | Create task                   |
| PATCH  | /api/tasks/:id                    | Update task (status, etc.)    |
| DELETE | /api/tasks/:id                    | Delete task                   |
| GET    | /api/comments?taskId=ID           | List comments on a task       |
| POST   | /api/comments                     | Add comment                   |
| GET    | /api/labels?projectId=ID          | List labels                   |
| POST   | /api/labels                       | Create label                  |
| GET    | /api/notifications                | My notifications               |
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
- Listen for `task:created`, `task:updated`, `task:deleted`, `comment:created`

The frontend already does this automatically per active project.

A background job (`dueDateScheduler.js`) runs hourly, checking for tasks due
within 24 hours or overdue, and writes a notification for the assignee.

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
- Multi-project workspace, project membership
- **Kanban board**: To Do → In Progress → In Review → Done, drag-and-drop status updates
- **List view**: sortable table of all tasks with status/priority/assignee/due date
- **Calendar view**: month grid with tasks plotted on their due date
- **Timeline view**: Gantt-style bars from creation date to due date
- Task fields: title, description, priority, assignee, due date, labels
- Task detail panel with live comments
- **File attachments**: real upload/download/delete (stored on disk, served at `/uploads/...`)
- **Real-time sync**: Socket.io — task creates/updates/deletes and new comments broadcast instantly to every connected client viewing that project (open the app in two tabs to see it)
- **Teams**: group project members into named teams (sidebar → Teams), then assign a task to a team instead of one person — every team member gets notified
- **Email notifications**: assigning a task (to a person or a team) sends an email via SMTP. If `SMTP_HOST` isn't configured, emails are logged to the console instead — see `backend/.env.example` for setup with Gmail or any transactional provider (Resend, SendGrid, Mailgun, Postmark)
- Background scheduler for due/overdue notifications (hourly job, writes to `notifications` table)
- Quick-add tasks per column

## What's next (ideas for future iterations)

- Drag-and-drop reordering *within* a column (currently only cross-column moves persist `position`)
- Per-user notification bell/dropdown UI (the API and data already exist — `GET /api/notifications`)
- Email delivery for due-date reminders (the scheduler currently only writes in-app notification rows)
- Role-based permissions (the `project_members.role` column exists but isn't enforced yet)
- Production deployment (Dockerfiles for backend/frontend, HTTPS, environment-specific configs)
