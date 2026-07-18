const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getRole, canWrite } = require("../middleware/permissions");
const { emitToProject } = require("../socket");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { taskId } = req.query;
  if (!taskId) return res.status(400).json({ error: "taskId query param is required" });

  const result = await db.query(
    `SELECT c.*, u.name AS author_name, u.initials AS author_initials, u.color AS author_color
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.task_id = $1 ORDER BY c.created_at ASC`,
    [taskId]
  );
  res.json(result.rows);
});

router.post("/", async (req, res) => {
  const { taskId, body } = req.body;
  if (!taskId || !body) return res.status(400).json({ error: "taskId and body are required" });

  const taskRow = await db.query("SELECT project_id FROM tasks WHERE id = $1", [taskId]);
  if (taskRow.rows.length === 0) return res.status(404).json({ error: "Task not found" });
  const role = await getRole(taskRow.rows[0].project_id, req.user.id);
  if (!canWrite(role)) return res.status(403).json({ error: "Viewers can view this project but can't make changes to it" });

  const result = await db.query(
    `INSERT INTO comments (task_id, author_id, body) VALUES ($1, $2, $3) RETURNING *`,
    [taskId, req.user.id, body]
  );

  emitToProject(taskRow.rows[0].project_id, "comment:created", {
    taskId: Number(taskId),
    comment: { ...result.rows[0], author_name: req.user.name },
  });

  res.status(201).json(result.rows[0]);
});

module.exports = router;
