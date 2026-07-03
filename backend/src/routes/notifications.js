const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const result = await db.query(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.user.id]
  );
  res.json(result.rows);
});

router.get("/unread-count", async (req, res) => {
  const result = await db.query(
    `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`,
    [req.user.id]
  );
  res.json({ count: Number(result.rows[0].count) });
});

// Returns unread counts grouped by task_id and project_id
router.get("/counts", async (req, res) => {
  const result = await db.query(
    `SELECT n.task_id, t.project_id, COUNT(*) AS count
     FROM notifications n
     LEFT JOIN tasks t ON t.id = n.task_id
     WHERE n.user_id = $1 AND n.is_read = false AND n.task_id IS NOT NULL
     GROUP BY n.task_id, t.project_id`,
    [req.user.id]
  );
  const byTask = {};
  const byProject = {};
  for (const row of result.rows) {
    byTask[row.task_id] = Number(row.count);
    if (row.project_id) {
      byProject[row.project_id] = (byProject[row.project_id] || 0) + Number(row.count);
    }
  }
  res.json({ byTask, byProject });
});

router.patch("/:id/read", async (req, res) => {
  const { id } = req.params;
  await db.query(`UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`, [
    id,
    req.user.id,
  ]);
  res.json({ ok: true });
});

router.patch("/read-all", async (req, res) => {
  await db.query(`UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`, [
    req.user.id,
  ]);
  res.json({ ok: true });
});

// DELETE /api/notifications/:id  — dismiss a single notification
router.delete("/:id", async (req, res) => {
  await db.query("DELETE FROM notifications WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
  res.json({ ok: true });
});

// DELETE /api/notifications  — clear all notifications for the current user
router.delete("/", async (req, res) => {
  await db.query("DELETE FROM notifications WHERE user_id = $1", [req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
