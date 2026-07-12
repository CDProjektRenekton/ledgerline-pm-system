const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { logHistory } = require("../history");

const router = express.Router();
router.use(requireAuth);

// GET /api/links?taskId=X
router.get("/", async (req, res) => {
  const { taskId } = req.query;
  if (!taskId) return res.status(400).json({ error: "taskId is required" });
  try {
    const result = await db.query(
      "SELECT * FROM task_links WHERE task_id = $1 ORDER BY created_at ASC",
      [taskId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /links failed:", err.message);
    res.status(500).json({ error: "Failed to load links" });
  }
});

// POST /api/links { taskId, label, url }
router.post("/", async (req, res) => {
  const { taskId, label, url } = req.body;
  if (!taskId || !label || !url) {
    return res.status(400).json({ error: "taskId, label, and url are required" });
  }
  try {
    const safeUrl = url.startsWith("http") ? url : `https://${url}`;
    const result = await db.query(
      "INSERT INTO task_links (task_id, label, url, created_by) VALUES ($1,$2,$3,$4) RETURNING *",
      [taskId, label.trim(), safeUrl, req.user.id]
    );
    logHistory(taskId, req.user.id, "link_added", `${req.user.name} added link "${label.trim()}"`).catch((e) => console.error("logHistory failed:", e.message));
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /links failed:", err.message);
    res.status(500).json({ error: "Failed to add link" });
  }
});

// DELETE /api/links/:id
router.delete("/:id", async (req, res) => {
  try {
    const existing = await db.query("SELECT * FROM task_links WHERE id = $1", [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "Link not found" });
    const link = existing.rows[0];
    await db.query("DELETE FROM task_links WHERE id = $1", [req.params.id]);
    logHistory(link.task_id, req.user.id, "link_removed", `${req.user.name} removed link "${link.label}"`).catch((e) => console.error("logHistory failed:", e.message));
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /links failed:", err.message);
    res.status(500).json({ error: "Failed to remove link" });
  }
});

module.exports = router;
