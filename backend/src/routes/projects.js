const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();
router.use(requireAuth);

// List active projects for the current user
router.get("/", async (req, res) => {
  const result = await db.query(
    `SELECT p.*, pm.role AS my_role,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count
     FROM projects p
     JOIN project_members pm ON pm.project_id = p.id
     WHERE pm.user_id = $1 AND p.is_archived = false
     ORDER BY p.created_at DESC`,
    [req.user.id]
  );
  res.json(result.rows);
});

// List archived projects for the current user
router.get("/archived", async (req, res) => {
  const result = await db.query(
    `SELECT p.*, pm.role AS my_role,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count
     FROM projects p
     JOIN project_members pm ON pm.project_id = p.id
     WHERE pm.user_id = $1 AND p.is_archived = true
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
    res.status(201).json({ ...project, my_role: "owner" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to create project" });
  } finally {
    client.release();
  }
});

// Add a member — requires admin or owner
router.post("/:id/members", requireRole("admin", "owner"), async (req, res) => {
  const { id } = req.params;
  const { userId, email, role } = req.body;
  try {
    let targetUserId = userId;
    if (!targetUserId && email) {
      const userResult = await db.query("SELECT id FROM users WHERE email = $1", [email.trim().toLowerCase()]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: "No account found with that email. They'll need to create one first." });
      }
      targetUserId = userResult.rows[0].id;
    }
    if (!targetUserId) return res.status(400).json({ error: "userId or email is required" });

    // Members can only be set to member role; admins/owners can set higher
    const allowedRole = req.projectRole === "owner" ? (role || "member") : "member";

    await db.query(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [id, targetUserId, allowedRole]
    );

    const memberResult = await db.query(
      `SELECT u.id, u.name, u.email, u.initials, u.color, pm.role
       FROM project_members pm JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [id, targetUserId]
    );
    res.status(201).json(memberResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add member" });
  }
});

// Update a member's role — owner only
router.patch("/:id/members/:userId/role", requireRole("owner"), async (req, res) => {
  const { id, userId } = req.params;
  const { role } = req.body;
  const VALID_ROLES = ["owner", "admin", "member"];
  if (!role || !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of ${VALID_ROLES.join(", ")}` });
  }
  const membership = await db.query(
    "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2",
    [id, userId]
  );
  if (membership.rows.length === 0) return res.status(404).json({ error: "Member not found" });
  if (membership.rows[0].role === "owner" && role !== "owner") {
    return res.status(400).json({ error: "Can't change the owner's role without transferring ownership" });
  }
  await db.query("UPDATE project_members SET role = $1 WHERE project_id = $2 AND user_id = $3", [role, id, userId]);
  res.json({ ok: true, role });
});

router.delete("/:id/members/:userId", requireRole("admin", "owner"), async (req, res) => {
  const { id, userId } = req.params;
  const membership = await db.query(
    "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2",
    [id, userId]
  );
  if (membership.rows.length > 0 && membership.rows[0].role === "owner") {
    return res.status(400).json({ error: "Can't remove the project owner" });
  }
  await db.query("DELETE FROM project_members WHERE project_id = $1 AND user_id = $2", [id, userId]);
  res.json({ ok: true });
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

// Archive or rename a project — admin or owner
router.patch("/:id", requireRole("admin", "owner"), async (req, res) => {
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

// Permanently delete — owner only
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const membership = await db.query(
    "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2",
    [id, req.user.id]
  );
  if (membership.rows.length === 0) return res.status(404).json({ error: "Project not found" });
  if (membership.rows[0].role !== "owner") {
    return res.status(403).json({ error: "Only the project owner can delete this project" });
  }
  const result = await db.query("DELETE FROM projects WHERE id = $1 RETURNING id", [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Project not found" });
  res.json({ ok: true });
});

module.exports = router;

