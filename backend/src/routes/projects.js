const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");
const { emitToUser, emitToProject } = require("../socket");

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

// Pending invitations addressed to the current user
router.get("/invites/pending", async (req, res) => {
  const result = await db.query(
    `SELECT pi.id, pi.project_id, pi.role, pi.created_at,
            p.name AS project_name, p.description AS project_description,
            u.name AS invited_by_name
     FROM project_invites pi
     JOIN projects p ON p.id = pi.project_id
     LEFT JOIN users u ON u.id = pi.invited_by
     WHERE pi.user_id = $1 AND pi.status = 'pending'
     ORDER BY pi.created_at DESC`,
    [req.user.id]
  );
  res.json(result.rows);
});

router.post("/invites/:inviteId/accept", async (req, res) => {
  const { inviteId } = req.params;
  const invite = await db.query(
    "SELECT * FROM project_invites WHERE id = $1 AND user_id = $2 AND status = 'pending'",
    [inviteId, req.user.id]
  );
  if (invite.rows.length === 0) return res.status(404).json({ error: "Invite not found" });
  const inv = invite.rows[0];

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ($1,$2,$3)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [inv.project_id, req.user.id, inv.role]
    );
    await client.query("UPDATE project_invites SET status = 'accepted' WHERE id = $1", [inviteId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ error: "Failed to accept invite" });
  } finally {
    client.release();
  }

  emitToProject(inv.project_id, "member:joined", { projectId: inv.project_id, userId: req.user.id });
  res.json({ ok: true, projectId: inv.project_id });
});

router.post("/invites/:inviteId/decline", async (req, res) => {
  const { inviteId } = req.params;
  const result = await db.query(
    "UPDATE project_invites SET status = 'declined' WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id",
    [inviteId, req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Invite not found" });
  res.json({ ok: true });
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

// Invite a member — requires admin or owner. Creates a PENDING invite;
// the invitee must accept before they're actually added to project_members.
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

    const existingMember = await db.query(
      "SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2",
      [id, targetUserId]
    );
    if (existingMember.rows.length > 0) {
      return res.status(409).json({ error: "This person is already a member of the project" });
    }

    const allowedRole = req.projectRole === "owner" ? (role || "contributor") : "contributor";

    const inviteResult = await db.query(
      `INSERT INTO project_invites (project_id, user_id, invited_by, role, status)
       VALUES ($1, $2, $3, $4, 'pending')
       ON CONFLICT (project_id, user_id) DO UPDATE SET status = 'pending', role = EXCLUDED.role, invited_by = EXCLUDED.invited_by
       RETURNING *`,
      [id, targetUserId, req.user.id, allowedRole]
    );

    const projRow = await db.query("SELECT name FROM projects WHERE id = $1", [id]);
    const notifResult = await db.query(
      `INSERT INTO notifications (user_id, type, message) VALUES ($1, 'project_invite', $2) RETURNING *`,
      [targetUserId, `${req.user.name} invited you to join "${projRow.rows[0]?.name || "a project"}"`]
    );
    emitToUser(targetUserId, "notification:new", notifResult.rows[0]);
    emitToUser(targetUserId, "invite:received", inviteResult.rows[0]);

    res.status(201).json({ pending: true, invite: inviteResult.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send invite" });
  }
});

// Update a member's role — owner only
router.patch("/:id/members/:userId/role", requireRole("owner"), async (req, res) => {
  const { id, userId } = req.params;
  const { role } = req.body;
  const VALID_ROLES = ["owner", "admin", "contributor", "viewer"];
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

// Generates a comprehensive snapshot of everything the project has been
// through: task breakdown, completion stats, team activity, full history.
router.get("/:id/report", async (req, res) => {
  const { id } = req.params;

  const projectRow = await db.query("SELECT * FROM projects WHERE id = $1", [id]);
  if (projectRow.rows.length === 0) return res.status(404).json({ error: "Project not found" });
  const project = projectRow.rows[0];

  const tasks = await db.query(
    `SELECT t.*, u.name AS assignee_name, tm.name AS team_name
     FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id LEFT JOIN teams tm ON tm.id = t.assignee_team_id
     WHERE t.project_id = $1 ORDER BY t.created_at`,
    [id]
  );

  const members = await db.query(
    `SELECT u.id, u.name, u.email, pm.role FROM project_members pm JOIN users u ON u.id = pm.user_id WHERE pm.project_id = $1`,
    [id]
  );

  const teams = await db.query(
    `SELECT t.id, t.name, COUNT(tm.user_id) AS member_count FROM teams t LEFT JOIN team_members tm ON tm.team_id = t.id WHERE t.project_id = $1 GROUP BY t.id`,
    [id]
  );

  const commentCount = await db.query(
    `SELECT COUNT(*) FROM comments c JOIN tasks t ON t.id = c.task_id WHERE t.project_id = $1`, [id]
  );
  const messageCount = await db.query(`SELECT COUNT(*) FROM project_messages WHERE project_id = $1`, [id]);
  const attachmentCount = await db.query(
    `SELECT COUNT(*) FROM attachments a JOIN tasks t ON t.id = a.task_id WHERE t.project_id = $1`, [id]
  );

  const allTasks = tasks.rows;
  const byStatus = {};
  const byPriority = {};
  const byCategory = {};
  const byAssignee = {};
  let overdueCount = 0;
  const today = new Date();
  for (const t of allTasks) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    byCategory[t.category || "simple"] = (byCategory[t.category || "simple"] || 0) + 1;
    const who = t.assignee_name || t.team_name || "Unassigned";
    byAssignee[who] = (byAssignee[who] || 0) + 1;
    if (t.due_date && new Date(t.due_date) < today && t.status !== "done") overdueCount++;
  }

  // Recent activity across all tasks in the project (last 30 entries)
  const recentActivity = await db.query(
    `SELECT h.detail, h.created_at, u.name AS actor_name, t.title AS task_title
     FROM task_history h
     JOIN tasks t ON t.id = h.task_id
     LEFT JOIN users u ON u.id = h.actor_id
     WHERE t.project_id = $1
     ORDER BY h.created_at DESC LIMIT 30`,
    [id]
  );

  res.json({
    project,
    generatedAt: new Date().toISOString(),
    summary: {
      totalTasks: allTasks.length,
      byStatus, byPriority, byCategory, byAssignee,
      overdueCount,
      memberCount: members.rows.length,
      teamCount: teams.rows.length,
      commentCount: Number(commentCount.rows[0].count),
      messageCount: Number(messageCount.rows[0].count),
      attachmentCount: Number(attachmentCount.rows[0].count),
    },
    members: members.rows,
    teams: teams.rows,
    tasks: allTasks,
    recentActivity: recentActivity.rows,
  });
});

// Leave a project (non-owners only)
router.post("/:id/leave", async (req, res) => {
  const { id } = req.params;
  const membership = await db.query(
    "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2",
    [id, req.user.id]
  );
  if (membership.rows.length === 0) return res.status(404).json({ error: "You are not a member of this project" });
  if (membership.rows[0].role === "owner") return res.status(400).json({ error: "The project owner cannot leave. Transfer ownership or delete the project." });
  await db.query("DELETE FROM project_members WHERE project_id = $1 AND user_id = $2", [id, req.user.id]);
  res.json({ ok: true });
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

