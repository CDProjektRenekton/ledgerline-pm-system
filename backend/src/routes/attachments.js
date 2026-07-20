const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getRole, canWrite } = require("../middleware/permissions");
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

// Allowlist rather than blocklist — safer for a tool that will be reachable
// from the internet, since a blocklist only stops the dangerous extensions
// someone thought to list. Covers what an office actually attaches to tasks:
// documents, spreadsheets, presentations, images, PDFs, and plain archives.
// Macro-enabled Office formats (.docm/.xlsm/.pptm) are deliberately excluded.
const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".doc", ".docx", ".odt", ".rtf", ".txt", ".csv",
  ".xls", ".xlsx", ".ods",
  ".ppt", ".pptx", ".odp",
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp",
  ".zip", ".rar", ".7z",
]);

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) cb(null, true);
    else cb(new Error(`"${ext || "that file type"}" isn't an allowed attachment type. Allowed: documents, spreadsheets, presentations, images, PDFs, and zip/rar/7z archives.`));
  },
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

// multer calls next(err) on a fileFilter/size-limit rejection, which would
// otherwise skip straight to the generic global error handler (a plain 500
// with no useful message). Catch it here so the person actually sees why
// their upload was rejected.
function handleUpload(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

router.post("/", handleUpload, async (req, res) => {
  const { taskId } = req.body;
  if (!taskId || !req.file) {
    return res.status(400).json({ error: "taskId and a file are required" });
  }

  const taskRow = await db.query("SELECT project_id FROM tasks WHERE id = $1", [taskId]);
  if (taskRow.rows.length === 0) {
    fs.unlink(req.file.path, () => {});
    return res.status(404).json({ error: "Task not found" });
  }
  const role = await getRole(taskRow.rows[0].project_id, req.user.id);
  if (!canWrite(role)) {
    fs.unlink(req.file.path, () => {}); // don't leave an orphaned upload on disk
    return res.status(403).json({ error: "Viewers can view this project but can't make changes to it" });
  }

  const url = `/uploads/${req.file.filename}`;
  const result = await db.query(
    `INSERT INTO attachments (task_id, filename, url, uploaded_by) VALUES ($1,$2,$3,$4) RETURNING *`,
    [taskId, req.file.originalname, url, req.user.id]
  );
  await logHistory(taskId, req.user.id, "attachment_added", `${req.user.name} attached "${req.file.originalname}"`);
  res.status(201).json(result.rows[0]);
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const existing = await db.query(
    "SELECT a.*, t.project_id FROM attachments a JOIN tasks t ON t.id = a.task_id WHERE a.id = $1",
    [id]
  );
  if (existing.rows.length === 0) return res.status(404).json({ error: "Attachment not found" });
  const role = await getRole(existing.rows[0].project_id, req.user.id);
  if (!canWrite(role)) return res.status(403).json({ error: "Viewers can view this project but can't make changes to it" });

  const filePath = path.join(UPLOAD_DIR, path.basename(existing.rows[0].url));
  fs.unlink(filePath, () => {}); // best-effort cleanup, ignore errors

  await db.query("DELETE FROM attachments WHERE id = $1", [id]);
  res.json({ ok: true });
});

module.exports = router;
