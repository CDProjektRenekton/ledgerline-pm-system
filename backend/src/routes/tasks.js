const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { emitToProject } = require("../socket");

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

// List tasks for a project (board view), with assignee + label info
router.get("/", async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ error: "projectId query param is required" });

  const result = await db.query(
    `SELECT t.*, 
            u.name AS assignee_name, u.initials AS assignee_initials, u.color AS assignee_color,
            (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) AS comment_count,
            (SELECT COUNT(*) FROM attachments a WHERE a.task_id = t.id) AS attachment_count
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assignee_id
     WHERE t.project_id = $1
     ORDER BY t.status, t.position, t.created_at`,
    [projectId]
  );
  const tasks = await attachLabels(result.rows);
  res.json(tasks);
});

// Create a task
router.post("/", async (req, res) => {
  const { projectId, title, description, priority, assigneeId, dueDate } = req.body;
  if (!projectId || !title) {
    return res.status(400).json({ error: "projectId and title are required" });
  }
  if (priority && !PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `priority must be one of ${PRIORITIES.join(", ")}` });
  }

  const result = await db.query(
    `INSERT INTO tasks (project_id, title, description, priority, assignee_id, due_date)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [projectId, title, description || "", priority || "medium", assigneeId || null, dueDate || null]
  );
  emitToProject(projectId, "task:created", result.rows[0]);
  res.status(201).json(result.rows[0]);
});

// Update a task (title, description, priority, assignee, due date, position, status)
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, status, priority, assigneeId, dueDate, position } = req.body;

  if (status && !STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(", ")}` });
  }

  const result = await db.query(
    `UPDATE tasks SET
       title = COALESCE($1, title),
       description = COALESCE($2, description),
       status = COALESCE($3, status),
       priority = COALESCE($4, priority),
       assignee_id = COALESCE($5, assignee_id),
       due_date = COALESCE($6, due_date),
       position = COALESCE($7, position),
       updated_at = now()
     WHERE id = $8 RETURNING *`,
    [title, description, status, priority, assigneeId, dueDate, position, id]
  );

  if (result.rows.length === 0) return res.status(404).json({ error: "Task not found" });

  emitToProject(result.rows[0].project_id, "task:updated", result.rows[0]);

  // Log a notification on status change
  if (status) {
    const task = result.rows[0];
    if (task.assignee_id) {
      await db.query(
        `INSERT INTO notifications (user_id, task_id, type, message)
         VALUES ($1, $2, 'status_change', $3)`,
        [task.assignee_id, task.id, `Task "${task.title}" moved to ${status}`]
      );
    }
  }

  res.json(result.rows[0]);
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
