const rateLimit = require("express-rate-limit");

// Applied to every /api route. Generous enough that normal use (including
// the Kanban board polling, notification bell, etc.) never comes close —
// this exists to blunt scripted abuse/DoS from a single client, not to
// throttle real usage.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down and try again shortly." },
});

// Applied only to login/register/forgot-password/reset-password/verify-email.
// These are the endpoints someone would actually script against to guess
// passwords or spam-register accounts, so the limit is much tighter. This is
// IP-based and complements (not replaces) the per-account lockout in
// routes/auth.js — the lockout stops repeated guesses against one account,
// this stops one IP from spraying attempts across many accounts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts from this network. Please wait a few minutes and try again." },
});

module.exports = { generalLimiter, authLimiter };
