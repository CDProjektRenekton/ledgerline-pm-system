const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { logHistory } = require("../history");

const router = express.Router();
router.use(requireAuth);

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.get("/", async (req, res) => {
  const { taskId } = req.query;
  if (!taskId) return res.status(400).json({ error: "taskId query param is required" });
  const result = await db.query(
    `SELECT a.*, u.name AS uploaded_by_name
     FROM attachments a LEFT JOIN users u ON u.id = a.uploaded_by
     WHERE a.task_id = $1 ORDER BY a.created_at DESC`,
    [taskId]
  );
  res.json(result.rows);
});

router.post("/", upload.single("file"), async (req, res) => {
  const { taskId } = req.body;
  if (!taskId || !req.file) {
    return res.status(400).json({ error: "taskId and a file are required" });
  }
  const url = `/uploads/${req.file.filename}`;
  const result = await db.query(
    `INSERT INTO attachments (task_id, filename, url, uploaded_by) VALUES ($1,$2,$3,$4) RETURNING *`,
    [taskId, req.file.originalname, url, req.user.id]
  );
  await logHistory(taskId, req.user.id, "attachment_added", `Attached "${req.file.originalname}"`);
  res.status(201).json(result.rows[0]);
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const existing = await db.query("SELECT * FROM attachments WHERE id = $1", [id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: "Attachment not found" });

  const filePath = path.join(UPLOAD_DIR, path.basename(existing.rows[0].url));
  fs.unlink(filePath, () => {}); // best-effort cleanup, ignore errors

  await db.query("DELETE FROM attachments WHERE id = $1", [id]);
  res.json({ ok: true });
});

module.exports = router;
