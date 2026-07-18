// Role middleware — attach after requireAuth.
// Usage: router.patch("/:id", requireAuth, requireRole("admin"), handler)
// Reads :id from req.params as the project_id (or pass projectId via req.body/query).

const db = require("../db");

function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    const projectId =
      req.params.id ||
      req.params.projectId ||
      req.body?.projectId ||
      req.query?.projectId;

    if (!projectId) return res.status(400).json({ error: "projectId is required for role check" });

    const result = await db.query(
      "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2",
      [projectId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: "You are not a member of this project" });
    }

    const userRole = result.rows[0].role;
    const { ROLE_RANK } = require("./permissions");
    const userRank = ROLE_RANK[userRole] || 0;
    const requiredRank = Math.min(...allowedRoles.map((r) => ROLE_RANK[r] || 0));

    if (userRank < requiredRank) {
      return res.status(403).json({
        error: `This action requires ${allowedRoles.join(" or ")} role. You are a ${userRole}.`,
      });
    }

    req.projectRole = userRole;
    next();
  };
}

module.exports = { requireRole };
