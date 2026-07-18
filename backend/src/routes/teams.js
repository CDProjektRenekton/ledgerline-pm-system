const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getRole, canWrite, blockViewerWrites } = require("../middleware/permissions");

const router = express.Router();
router.use(requireAuth);

async function attachMembers(teams) {
  if (teams.length === 0) return teams;
  const ids = teams.map((t) => t.id);
  const result = await db.query(
    `SELECT tm.team_id, u.id, u.name, u.email, u.initials, u.color
     FROM team_members tm JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = ANY($1::int[])`,
    [ids]
  );
  const byTeam = {};
  for (const row of result.rows) {
    byTeam[row.team_id] = byTeam[row.team_id] || [];
    byTeam[row.team_id].push({ id: row.id, name: row.name, email: row.email, initials: row.initials, color: row.color });
  }
  return teams.map((t) => ({ ...t, members: byTeam[t.id] || [] }));
}

router.get("/", async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ error: "projectId query param is required" });
  const result = await db.query("SELECT * FROM teams WHERE project_id = $1 ORDER BY name", [projectId]);
  const teams = await attachMembers(result.rows);
  res.json(teams);
});

router.post("/", blockViewerWrites((req) => req.body.projectId), async (req, res) => {
  const { projectId, name, color } = req.body;
  if (!projectId || !name) return res.status(400).json({ error: "projectId and name are required" });
  try {
    const result = await db.query(
      `INSERT INTO teams (project_id, name, color) VALUES ($1, $2, $3) RETURNING *`,
      [projectId, name, color || "#1F6F78"]
    );
    res.status(201).json({ ...result.rows[0], members: [] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "A team with this name already exists in this project" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create team" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const existing = await db.query("SELECT project_id FROM teams WHERE id = $1", [id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: "Team not found" });
  const role = await getRole(existing.rows[0].project_id, req.user.id);
  if (!canWrite(role)) return res.status(403).json({ error: "Viewers can view this project but can't make changes to it" });
  await db.query("DELETE FROM teams WHERE id = $1", [id]);
  res.json({ ok: true });
});

router.post("/:id/members", async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required" });
  const teamRow = await db.query("SELECT project_id FROM teams WHERE id = $1", [id]);
  if (teamRow.rows.length === 0) return res.status(404).json({ error: "Team not found" });
  const role = await getRole(teamRow.rows[0].project_id, req.user.id);
  if (!canWrite(role)) return res.status(403).json({ error: "Viewers can view this project but can't make changes to it" });
  await db.query(
    `INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [id, userId]
  );
  res.status(201).json({ ok: true });
});

router.delete("/:id/members/:userId", async (req, res) => {
  const { id, userId } = req.params;
  const teamRow = await db.query("SELECT project_id FROM teams WHERE id = $1", [id]);
  if (teamRow.rows.length === 0) return res.status(404).json({ error: "Team not found" });
  const role = await getRole(teamRow.rows[0].project_id, req.user.id);
  if (!canWrite(role)) return res.status(403).json({ error: "Viewers can view this project but can't make changes to it" });
  await db.query(`DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`, [id, userId]);
  res.json({ ok: true });
});

module.exports = router;
