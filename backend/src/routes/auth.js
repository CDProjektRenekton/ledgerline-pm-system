const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { sendPasswordResetEmail } = require("../email");

const router = express.Router();

const COLORS = ["#1F6F78", "#C9A227", "#9C4221", "#3F7D52", "#5C7A89"];

function initialsFor(name) {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    initials: u.initials,
    color: u.color,
  };
}

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, and password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  try {
    const existing = await db.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const initials = initialsFor(name);
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];

    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, initials, color)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, initials, color`,
      [name, email, passwordHash, initials, color]
    );

    const user = result.rows[0];
    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to register user" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to log in" });
  }
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "email is required" });

  // Always respond the same way, whether or not the email exists —
  // this avoids letting someone probe which addresses have accounts.
  const genericResponse = { message: "If an account exists for that email, a reset link has been sent." };

  try {
    const userResult = await db.query("SELECT id, name, email FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) return res.json(genericResponse);

    const user = userResult.rows[0];
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.query(
      `INSERT INTO password_resets (token, user_id, expires_at) VALUES ($1, $2, $3)`,
      [token, user.id, expiresAt]
    );

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetUrl = `${frontendUrl}/?reset_token=${token}`;

    sendPasswordResetEmail({ to: user.email, recipientName: user.name, resetUrl }).catch((err) =>
      console.error("Password reset email failed:", err.message)
    );

    res.json(genericResponse);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process reset request" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: "token and newPassword are required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  try {
    const resetResult = await db.query(
      "SELECT * FROM password_resets WHERE token = $1 AND expires_at > now()",
      [token]
    );
    if (resetResult.rows.length === 0) {
      return res.status(400).json({ error: "This reset link is invalid or has expired" });
    }
    const reset = resetResult.rows[0];

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, reset.user_id]);
    await db.query("DELETE FROM password_resets WHERE user_id = $1", [reset.user_id]);

    res.json({ message: "Password updated. You can now log in." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, name, email, initials, color FROM users WHERE id = $1",
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json({ user: publicUser(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load session" });
  }
});

module.exports = router;
module.exports.publicUser = publicUser;

