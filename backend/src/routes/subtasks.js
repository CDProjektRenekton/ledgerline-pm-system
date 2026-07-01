const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { emitToProject } = require("../socket");
const { logHistory } = require("../history");

const router = express.Router();
router.use(requireAuth);

// GET /api/subtasks?taskId=X
router.get("/", async (req, res) => {
  const { taskId } = req.query;
  if (!taskId) return res.status(400).json({ error: "taskId is required" });
  const result = await db.query(
    "SELECT * FROM subtasks WHERE task_id = $1 ORDER BY position, created_at",
    [taskId]
  );
  res.json(result.rows);
});

// POST /api/subtasks  { taskId, title, targetAt? }
router.post("/", async (req, res) => {
  const { taskId, title, targetAt } = req.body;
  if (!taskId || !title) return res.status(400).json({ error: "taskId and title are required" });

  const countResult = await db.query("SELECT COUNT(*) FROM subtasks WHERE task_id = $1", [taskId]);
  const position = Number(countResult.rows[0].count);

  const result = await db.query(
    "INSERT INTO subtasks (task_id, title, position, target_at) VALUES ($1,$2,$3,$4) RETURNING *",
    [taskId, title.trim(), position, targetAt || null]
  );

  const taskRow = await db.query("SELECT project_id FROM tasks WHERE id = $1", [taskId]);
  if (taskRow.rows.length > 0) {
    emitToProject(taskRow.rows[0].project_id, "subtask:created", result.rows[0]);
    await logHistory(taskId, req.user.id, "subtask_added", `Subtask "${title.trim()}" added${targetAt ? ` (target: ${new Date(targetAt).toLocaleString()})` : ""}`);
  }
  res.status(201).json(result.rows[0]);
});

// PATCH /api/subtasks/:id  { title?, is_done?, targetAt? }
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { title, is_done, targetAt } = req.body;

  const existing = await db.query("SELECT * FROM subtasks WHERE id = $1", [id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: "Subtask not found" });
  const sub = existing.rows[0];

  const result = await db.query(
    `UPDATE subtasks SET
       title = COALESCE($1, title),
       is_done = COALESCE($2, is_done),
       target_at = CASE WHEN $4 THEN $3 ELSE target_at END
     WHERE id = $5 RETURNING *`,
    [title !== undefined ? title.trim() : null, is_done !== undefined ? is_done : null, targetAt || null, "targetAt" in req.body, id]
  );

  const taskRow = await db.query("SELECT project_id FROM tasks WHERE id = $1", [sub.task_id]);
  if (taskRow.rows.length > 0) {
    emitToProject(taskRow.rows[0].project_id, "subtask:updated", result.rows[0]);
    if (is_done !== undefined && is_done !== sub.is_done) {
      await logHistory(
        sub.task_id,
        req.user.id,
        "subtask_toggled",
        `Subtask "${result.rows[0].title}" marked ${is_done ? "done" : "not done"}`
      );
    }
  }
  res.json(result.rows[0]);
});

// DELETE /api/subtasks/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const existing = await db.query("SELECT s.*, t.project_id FROM subtasks s JOIN tasks t ON t.id = s.task_id WHERE s.id = $1", [id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: "Subtask not found" });
  await db.query("DELETE FROM subtasks WHERE id = $1", [id]);
  emitToProject(existing.rows[0].project_id, "subtask:deleted", { id: Number(id), task_id: existing.rows[0].task_id });
  res.json({ ok: true });
});

module.exports = router;
