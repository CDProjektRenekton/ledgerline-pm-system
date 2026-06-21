const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { emitToProject } = require("../socket");
const { sendAssignmentEmail } = require("../email");

const router = express.Router();
router.use(requireAuth);

const STATUSES = ["todo", "inprogress", "review", "done"];
const PRIORITIES = ["low", "medium", "high"];

async function attachLabels(tasks) {
  if (tasks.length === 0) return tasks;
  const ids = tasks.map((t) => t.id);
  const result = await db.query(
    `SELECT tl.task_id, l.id, l.name, l.color
     FROM task_labels tl JOIN labels l ON l.id = tl.label_id
     WHERE tl.task_id = ANY($1::int[])`,
    [ids]
  );
  const byTask = {};
  for (const row of result.rows) {
    byTask[row.task_id] = byTask[row.task_id] || [];
    byTask[row.task_id].push({ id: row.id, name: row.name, color: row.color });
  }
  return tasks.map((t) => ({ ...t, labels: byTask[t.id] || [] }));
}

// Records a notification row and fires off an (async, non-blocking) email
// for a single user being assigned a task.
async function notifyAssignment(userId, task, assignedByName) {
  const userResult = await db.query("SELECT name, email FROM users WHERE id = $1", [userId]);
  if (userResult.rows.length === 0) return;
  const user = userResult.rows[0];

  await db.query(
    `INSERT INTO notifications (user_id, task_id, type, message) VALUES ($1,$2,'assigned',$3)`,
    [userId, task.id, `You were assigned: "${task.title}"`]
  );

  const projResult = await db.query("SELECT name FROM projects WHERE id = $1", [task.project_id]);
  const projectName = projResult.rows[0] ? projResult.rows[0].name : "a project";

  // Fire-and-forget so a slow/misconfigured mail server never blocks the API response.
  sendAssignmentEmail({
    to: user.email,
    recipientName: user.name,
    taskTitle: task.title,
    projectName,
    assignedByName,
  }).catch((err) => console.error("Assignment email failed:", err.message));
}

async function notifyTeamAssignment(teamId, task, assignedByName) {
  const members = await db.query("SELECT user_id FROM team_members WHERE team_id = $1", [teamId]);
  for (const row of members.rows) {
    await notifyAssignment(row.user_id, task, assignedByName);
  }
}

// List tasks for a project (board view), with assignee/team + label info
router.get("/", async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ error: "projectId query param is required" });

  const result = await db.query(
    `SELECT t.*, 
            u.name AS assignee_name, u.initials AS assignee_initials, u.color AS assignee_color,
            tm.name AS team_name, tm.color AS team_color,
            (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) AS comment_count,
            (SELECT COUNT(*) FROM attachments a WHERE a.task_id = t.id) AS attachment_count
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assignee_id
     LEFT JOIN teams tm ON tm.id = t.assignee_team_id
     WHERE t.project_id = $1
     ORDER BY t.status, t.position, t.created_at`,
    [projectId]
  );
  const tasks = await attachLabels(result.rows);
  res.json(tasks);
});

// Create a task — assignee can be a single user (assigneeId) OR a team (assigneeTeamId), not both.
router.post("/", async (req, res) => {
  const { projectId, title, description, priority, assigneeId, assigneeTeamId, dueDate } = req.body;
  if (!projectId || !title) {
    return res.status(400).json({ error: "projectId and title are required" });
  }
  if (priority && !PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `priority must be one of ${PRIORITIES.join(", ")}` });
  }

  const finalAssigneeId = assigneeTeamId ? null : assigneeId || null;
  const finalTeamId = assigneeTeamId || null;

  const result = await db.query(
    `INSERT INTO tasks (project_id, title, description, priority, assignee_id, assignee_team_id, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [projectId, title, description || "", priority || "medium", finalAssigneeId, finalTeamId, dueDate || null]
  );
  const task = result.rows[0];
  emitToProject(projectId, "task:created", task);

  if (finalAssigneeId) notifyAssignment(finalAssigneeId, task, req.user.name).catch(() => {});
  if (finalTeamId) notifyTeamAssignment(finalTeamId, task, req.user.name).catch(() => {});

  res.status(201).json(task);
});

// Update a task. Reads the existing row first so that an explicit `null`
// (e.g. unassigning) can be told apart from "field not included in this request".
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  if (body.status && !STATUSES.includes(body.status)) {
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(", ")}` });
  }
  if (body.priority && !PRIORITIES.includes(body.priority)) {
    return res.status(400).json({ error: `priority must be one of ${PRIORITIES.join(", ")}` });
  }

  const existingResult = await db.query("SELECT * FROM tasks WHERE id = $1", [id]);
  if (existingResult.rows.length === 0) return res.status(404).json({ error: "Task not found" });
  const existing = existingResult.rows[0];

  const next = {
    title: "title" in body ? body.title : existing.title,
    description: "description" in body ? body.description : existing.description,
    status: "status" in body ? body.status : existing.status,
    priority: "priority" in body ? body.priority : existing.priority,
    due_date: "dueDate" in body ? body.dueDate || null : existing.due_date,
    position: "position" in body ? body.position : existing.position,
    assignee_id: existing.assignee_id,
    assignee_team_id: existing.assignee_team_id,
  };

  // Assigning a person clears any team assignment, and vice versa.
  if ("assigneeId" in body) {
    next.assignee_id = body.assigneeId || null;
    if (body.assigneeId) next.assignee_team_id = null;
  }
  if ("assigneeTeamId" in body) {
    next.assignee_team_id = body.assigneeTeamId || null;
    if (body.assigneeTeamId) next.assignee_id = null;
  }

  const result = await db.query(
    `UPDATE tasks SET
       title=$1, description=$2, status=$3, priority=$4,
       assignee_id=$5, assignee_team_id=$6, due_date=$7, position=$8, updated_at=now()
     WHERE id=$9 RETURNING *`,
    [next.title, next.description, next.status, next.priority, next.assignee_id, next.assignee_team_id, next.due_date, next.position, id]
  );

  const task = result.rows[0];
  emitToProject(task.project_id, "task:updated", task);

  // Status-change notification for whoever's currently assigned
  if (body.status && task.assignee_id) {
    await db.query(
      `INSERT INTO notifications (user_id, task_id, type, message) VALUES ($1, $2, 'status_change', $3)`,
      [task.assignee_id, task.id, `Task "${task.title}" moved to ${body.status}`]
    );
  }

  // New-assignment notification + email (only fires when the assignment actually changed)
  if ("assigneeId" in body && task.assignee_id && task.assignee_id !== existing.assignee_id) {
    notifyAssignment(task.assignee_id, task, req.user.name).catch(() => {});
  }
  if ("assigneeTeamId" in body && task.assignee_team_id && task.assignee_team_id !== existing.assignee_team_id) {
    notifyTeamAssignment(task.assignee_team_id, task, req.user.name).catch(() => {});
  }

  res.json(task);
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const existing = await db.query("SELECT project_id FROM tasks WHERE id = $1", [id]);
  const result = await db.query("DELETE FROM tasks WHERE id = $1 RETURNING id", [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Task not found" });
  if (existing.rows.length > 0) {
    emitToProject(existing.rows[0].project_id, "task:deleted", { id: Number(id) });
  }
  res.json({ ok: true });
});

// Attach / detach labels
router.post("/:id/labels/:labelId", async (req, res) => {
  const { id, labelId } = req.params;
  await db.query(
    `INSERT INTO task_labels (task_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [id, labelId]
  );
  res.status(201).json({ ok: true });
});

router.delete("/:id/labels/:labelId", async (req, res) => {
  const { id, labelId } = req.params;
  await db.query(`DELETE FROM task_labels WHERE task_id = $1 AND label_id = $2`, [id, labelId]);
  res.json({ ok: true });
});

module.exports = router;
