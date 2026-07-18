// Shared helpers for the contributor/viewer role system.
// Roles, from most to least access: owner > admin > contributor > viewer.
// Viewers can read everything they're a member of, but can't write anything
// — no status changes, no subtasks, no comments, no attachments, no links,
// no chat messages, no team edits. Every other role can write normally.

const db = require("../db");

const ROLE_RANK = { owner: 4, admin: 3, contributor: 2, viewer: 1 };

// Returns the caller's role string for a project, or null if they aren't a member.
async function getRole(projectId, userId) {
  if (!projectId || !userId) return null;
  const r = await db.query(
    "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2",
    [projectId, userId]
  );
  return r.rows[0]?.role || null;
}

// Everyone except viewers (and non-members) can create/edit/delete content.
function canWrite(role) {
  return role === "owner" || role === "admin" || role === "contributor";
}

// Express middleware for the common case: projectId is directly available
// on req.body or req.query (task creation, reorder, chat messages, teams,
// labels). For routes where the project first has to be looked up via a
// task/subtask/comment/etc id, call getRole()/canWrite() directly inside
// the handler instead (see tasks.js PATCH/DELETE for an example) — an
// extra query per request there is cheaper than a second DB round trip.
function blockViewerWrites(getProjectId) {
  return async (req, res, next) => {
    const projectId = await getProjectId(req);
    if (!projectId) return next(); // let the handler's own validation report the real error
    const role = await getRole(projectId, req.user.id);
    if (!role) return res.status(403).json({ error: "You are not a member of this project" });
    if (!canWrite(role)) return res.status(403).json({ error: "Viewers can view this project but can't make changes to it" });
    req.projectRole = role;
    next();
  };
}

module.exports = { getRole, canWrite, blockViewerWrites, ROLE_RANK };
