const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { requireSuperAdmin } = require("../middleware/superAdmin");

const router = express.Router();

// The exact palette the app has always shipped with (see Dashboard.jsx
// .pm-root CSS variables) — used as the fallback whenever the super admin
// hasn't customized the system theme yet, so nothing changes visually for
// anyone until a super admin actively sets new colors.
const DEFAULT_THEME = {
  ink: "#0B2233",
  paper: "#EEF6FC",
  paperDeep: "#DCF0FB",
  card: "#FFFFFF",
  muted: "#6B92AD",
  border: "#C5DFF0",
  teal: "#1A7FA8",
  tealDeep: "#0B4F6C",
  sidebarFrom: "#0B4F6C",
  sidebarTo: "#1A7FA8",
};

// ----- GET system theme (public — no auth required) -----
// Read-only color palette, safe to expose pre-login (e.g. so a future login
// screen or splash could use it too). Never includes user data.
router.get("/system-theme", async (req, res) => {
  try {
    const result = await db.query("SELECT value FROM system_settings WHERE key = 'theme'");
    if (result.rows.length === 0) return res.json({ theme: null, defaults: DEFAULT_THEME });
    let theme;
    try {
      theme = JSON.parse(result.rows[0].value);
    } catch {
      theme = null;
    }
    res.json({ theme, defaults: DEFAULT_THEME });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load system theme" });
  }
});

// Everything below requires a logged-in super admin.
router.use(requireAuth, requireSuperAdmin);

// ----- PUT system theme -----
router.put("/system-theme", async (req, res) => {
  const { theme } = req.body;
  if (!theme || typeof theme !== "object")
    return res.status(400).json({ error: "theme object is required" });

  // Only accept known keys with string values — ignore anything else so a
  // malformed payload can't corrupt the stored JSON or inject unexpected data.
  const allowedKeys = Object.keys(DEFAULT_THEME);
  const clean = {};
  for (const key of allowedKeys) {
    if (typeof theme[key] === "string" && theme[key].trim()) clean[key] = theme[key].trim();
  }

  try {
    await db.query(
      `INSERT INTO system_settings (key, value, updated_at) VALUES ('theme', $1, now())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
      [JSON.stringify(clean)]
    );
    res.json({ message: "System theme updated.", theme: clean });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save system theme" });
  }
});

// ----- DELETE system theme (reset to the original default palette) -----
router.delete("/system-theme", async (req, res) => {
  try {
    await db.query("DELETE FROM system_settings WHERE key = 'theme'");
    res.json({ message: "System theme reset to default." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reset system theme" });
  }
});

// ----- List all users -----
router.get("/users", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, email, initials, color, is_verified, is_active, is_super_admin,
              avatar_url, theme, created_at
       FROM users ORDER BY created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load users" });
  }
});

// ----- Update a user's name/email (their "login") -----
router.patch("/users/:id", async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  if (!name && !email) return res.status(400).json({ error: "name or email is required" });

  try {
    const existing = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "User not found" });

    if (email) {
      const dupe = await db.query("SELECT id FROM users WHERE email = $1 AND id != $2", [email.toLowerCase(), id]);
      if (dupe.rows.length > 0) return res.status(409).json({ error: "Another account already uses that login/email" });
    }

    const nextName = name || existing.rows[0].name;
    const nextEmail = email ? email.toLowerCase() : existing.rows[0].email;
    const result = await db.query(
      `UPDATE users SET name = $1, email = $2 WHERE id = $3
       RETURNING id, name, email, initials, color, is_verified, is_active, is_super_admin, avatar_url, theme, created_at`,
      [nextName, nextEmail, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// ----- Reset a user's password directly (no current password needed) -----
router.post("/users/:id/reset-password", async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8)
    return res.status(400).json({ error: "newPassword must be at least 8 characters" });

  try {
    const existing = await db.query("SELECT id FROM users WHERE id = $1", [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "User not found" });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.query(
      "UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL WHERE id = $2",
      [hash, id]
    );
    res.json({ message: "Password reset successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// ----- Activate / deactivate a user -----
router.patch("/users/:id/active", async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  if (typeof is_active !== "boolean") return res.status(400).json({ error: "is_active (boolean) is required" });

  if (Number(id) === req.user.id && !is_active)
    return res.status(400).json({ error: "You can't deactivate your own account." });

  try {
    const existing = await db.query("SELECT id FROM users WHERE id = $1", [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "User not found" });

    await db.query(
      "UPDATE users SET is_active = $1, failed_login_attempts = 0, locked_until = NULL WHERE id = $2",
      [is_active, id]
    );
    res.json({ message: is_active ? "Account reactivated." : "Account deactivated." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update account status" });
  }
});

// ----- Grant / revoke super admin -----
router.patch("/users/:id/super-admin", async (req, res) => {
  const { id } = req.params;
  const { is_super_admin } = req.body;
  if (typeof is_super_admin !== "boolean") return res.status(400).json({ error: "is_super_admin (boolean) is required" });

  try {
    if (!is_super_admin) {
      // Don't allow the last remaining super admin to be demoted — the
      // system must always keep at least one account that can manage users.
      const countResult = await db.query("SELECT COUNT(*) FROM users WHERE is_super_admin = true");
      if (Number(countResult.rows[0].count) <= 1) {
        return res.status(400).json({ error: "At least one super admin must remain." });
      }
    }
    const existing = await db.query("SELECT id FROM users WHERE id = $1", [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "User not found" });

    await db.query("UPDATE users SET is_super_admin = $1 WHERE id = $2", [is_super_admin, id]);
    res.json({ message: is_super_admin ? "Granted super admin access." : "Revoked super admin access." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update super admin status" });
  }
});

module.exports = router;
