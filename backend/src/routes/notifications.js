const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const result = await db.query(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.user.id]
  );
  res.json(result.rows);
});

router.patch("/:id/read", async (req, res) => {
  const { id } = req.params;
  await db.query(`UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`, [
    id,
    req.user.id,
  ]);
  res.json({ ok: true });
});

module.exports = router;
