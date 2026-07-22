// Super-admin middleware — attach after requireAuth.
// System-level (not per-project) — checks the users.is_super_admin flag
// fresh from the database on every request rather than trusting the JWT,
// so a demoted super admin loses access immediately without waiting for
// their token to expire.

const db = require("../db");

async function requireSuperAdmin(req, res, next) {
  try {
    const result = await db.query("SELECT is_super_admin FROM users WHERE id = $1", [req.user.id]);
    if (result.rows.length === 0 || !result.rows[0].is_super_admin) {
      return res.status(403).json({ error: "This action requires super admin access." });
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to verify admin access" });
  }
}

module.exports = { requireSuperAdmin };
