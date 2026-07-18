// Populates the database with a demo user, project, team members, and tasks
// matching the original Kanban prototype. Run with: npm run seed
require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./db");

const TEAM = [
  { name: "Jister John", email: "jister@example.com", initials: "JJ", color: "#1F6F78" },
  { name: "Mara Alano", email: "mara@example.com", initials: "MA", color: "#C9A227" },
  { name: "Rico Cruz", email: "rico@example.com", initials: "RC", color: "#9C4221" },
  { name: "Lia Domingo", email: "lia@example.com", initials: "LD", color: "#3F7D52" },
];

const TASKS = [
  { title: "Define database schema for tasks & projects", status: "todo", priority: "high", assignee: 0, due: "2026-06-25", labels: ["Backend"] },
  { title: "Set up auth (login, sign-up, SSO)", status: "todo", priority: "medium", assignee: 2, due: "2026-06-27", labels: ["Backend", "Security"] },
  { title: "Build Kanban board view", status: "inprogress", priority: "high", assignee: 0, due: "2026-06-22", labels: ["Frontend"] },
  { title: "Design notification scheduler", status: "inprogress", priority: "medium", assignee: 3, due: "2026-06-29", labels: ["Backend"] },
  { title: "Task detail side panel", status: "review", priority: "medium", assignee: 1, due: "2026-06-21", labels: ["Frontend"] },
  { title: "Workspace dashboard layout", status: "done", priority: "low", assignee: 0, due: "2026-06-18", labels: ["Frontend"] },
  { title: "Project creation flow", status: "done", priority: "medium", assignee: 2, due: "2026-06-17", labels: ["Frontend", "Backend"] },
];

async function seed() {
  const userIds = [];
  for (const member of TEAM) {
    const passwordHash = await bcrypt.hash("password123", 10);
    const existing = await db.query("SELECT id FROM users WHERE email = $1", [member.email]);
    if (existing.rows.length > 0) {
      userIds.push(existing.rows[0].id);
      continue;
    }
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, initials, color) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [member.name, member.email, passwordHash, member.initials, member.color]
    );
    userIds.push(result.rows[0].id);
  }
  console.log(`Users ready: ${userIds.join(", ")} (password for all: password123)`);

  let projectId;
  const existingProj = await db.query("SELECT id FROM projects WHERE name = $1", ["Task Tracking System"]);
  if (existingProj.rows.length > 0) {
    projectId = existingProj.rows[0].id;
  } else {
    const proj = await db.query(
      `INSERT INTO projects (name, description, owner_id) VALUES ($1,$2,$3) RETURNING id`,
      ["Task Tracking System", "Internal project management tool", userIds[0]]
    );
    projectId = proj.rows[0].id;
    for (const uid of userIds) {
      await db.query(
        `INSERT INTO project_members (project_id, user_id, role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [projectId, uid, uid === userIds[0] ? "owner" : "contributor"]
      );
    }
  }
  console.log(`Project ready: ${projectId}`);

  const labelCache = {};
  async function getLabelId(name) {
    if (labelCache[name]) return labelCache[name];
    const existing = await db.query("SELECT id FROM labels WHERE project_id = $1 AND name = $2", [projectId, name]);
    if (existing.rows.length > 0) {
      labelCache[name] = existing.rows[0].id;
      return labelCache[name];
    }
    const colors = { Backend: "#1F6F78", Frontend: "#C9A227", Security: "#9C4221" };
    const result = await db.query(
      "INSERT INTO labels (project_id, name, color) VALUES ($1,$2,$3) RETURNING id",
      [projectId, name, colors[name] || "#8B8680"]
    );
    labelCache[name] = result.rows[0].id;
    return labelCache[name];
  }

  for (const t of TASKS) {
    const existing = await db.query("SELECT id FROM tasks WHERE project_id = $1 AND title = $2", [projectId, t.title]);
    let taskId;
    if (existing.rows.length > 0) {
      taskId = existing.rows[0].id;
    } else {
      const result = await db.query(
        `INSERT INTO tasks (project_id, title, status, priority, assignee_id, due_date)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [projectId, t.title, t.status, t.priority, userIds[t.assignee], t.due]
      );
      taskId = result.rows[0].id;
    }
    for (const labelName of t.labels) {
      const labelId = await getLabelId(labelName);
      await db.query(
        "INSERT INTO task_labels (task_id, label_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [taskId, labelId]
      );
    }
  }
  console.log(`Seeded ${TASKS.length} tasks.`);
  console.log("\nDemo login: jister@example.com / password123");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
