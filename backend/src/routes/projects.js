const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// List all projects the current user is a member of
router.get("/", async (req, res) => {
  const result = await db.query(
    `SELECT p.*, 
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count
     FROM projects p
     JOIN project_members pm ON pm.project_id = p.id
     WHERE pm.user_id = $1 AND p.is_archived = false
     ORDER BY p.created_at DESC`,
    [req.user.id]
  );
  res.json(result.rows);
});

// Create a project (creator becomes owner + member)
router.post("/", async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "Project name is required" });

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const projResult = await client.query(
      `INSERT INTO projects (name, description, owner_id) VALUES ($1, $2, $3) RETURNING *`,
      [name, description || "", req.user.id]
    );
    const project = projResult.rows[0];
    await client.query(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [project.id, req.user.id]
    );
    await client.query("COMMIT");
    res.status(201).json(project);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to create project" });
  } finally {
    client.release();
  }
});

// Add a member to a project
router.post("/:id/members", async (req, res) => {
  const { id } = req.params;
  const { userId, role } = req.body;
  try {
    await db.query(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [id, userId, role || "member"]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add member" });
  }
});

router.get("/:id/members", async (req, res) => {
  const { id } = req.params;
  const result = await db.query(
    `SELECT u.id, u.name, u.email, u.initials, u.color, pm.role
     FROM project_members pm JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1`,
    [id]
  );
  res.json(result.rows);
});

// Archive a project
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, description, is_archived } = req.body;
  const result = await db.query(
    `UPDATE projects SET
       name = COALESCE($1, name),
       description = COALESCE($2, description),
       is_archived = COALESCE($3, is_archived)
     WHERE id = $4 RETURNING *`,
    [name, description, is_archived, id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Project not found" });
  res.json(result.rows[0]);
});

// Permanently delete a project (and, via ON DELETE CASCADE, everything in
// it: tasks, comments, attachments, labels, teams, memberships). Only the
// owner can do this.
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const membership = await db.query(
    "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2",
    [id, req.user.id]
  );
  if (membership.rows.length === 0) {
    return res.status(404).json({ error: "Project not found" });
  }
  if (membership.rows[0].role !== "owner") {
    return res.status(403).json({ error: "Only the project owner can delete this project" });
  }

  const result = await db.query("DELETE FROM projects WHERE id = $1 RETURNING id", [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Project not found" });
  res.json({ ok: true });
});

module.exports = router;
