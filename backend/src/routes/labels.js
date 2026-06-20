const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ error: "projectId query param is required" });
  const result = await db.query("SELECT * FROM labels WHERE project_id = $1 ORDER BY name", [projectId]);
  res.json(result.rows);
});

router.post("/", async (req, res) => {
  const { projectId, name, color } = req.body;
  if (!projectId || !name) return res.status(400).json({ error: "projectId and name are required" });
  const result = await db.query(
    `INSERT INTO labels (project_id, name, color) VALUES ($1, $2, $3) RETURNING *`,
    [projectId, name, color || "#8B8680"]
  );
  res.status(201).json(result.rows[0]);
});

module.exports = router;
