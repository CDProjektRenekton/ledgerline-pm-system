const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
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

  const result = await db.query(
    `INSERT INTO comments (task_id, author_id, body) VALUES ($1, $2, $3) RETURNING *`,
    [taskId, req.user.id, body]
  );

  const taskRow = await db.query("SELECT project_id FROM tasks WHERE id = $1", [taskId]);
  if (taskRow.rows.length > 0) {
    emitToProject(taskRow.rows[0].project_id, "comment:created", {
      taskId: Number(taskId),
      comment: { ...result.rows[0], author_name: req.user.name },
    });
  }

  res.status(201).json(result.rows[0]);
});

module.exports = router;
