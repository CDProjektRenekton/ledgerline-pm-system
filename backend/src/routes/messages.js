const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { emitToProject, emitToUser } = require("../socket");

const router = express.Router();
router.use(requireAuth);

// GET /api/messages?projectId=X
router.get("/", async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ error: "projectId is required" });

  const result = await db.query(
    `SELECT m.*,
            u.name AS author_name, u.initials AS author_initials, u.color AS author_color,
            t.title AS task_ref_title,
            COALESCE(
              json_agg(DISTINCT jsonb_build_object('id', mu.id, 'name', mu.name)) FILTER (WHERE mu.id IS NOT NULL),
              '[]'
            ) AS mentions
     FROM project_messages m
     JOIN users u ON u.id = m.author_id
     LEFT JOIN tasks t ON t.id = m.task_ref_id
     LEFT JOIN message_mentions mm ON mm.message_id = m.id
     LEFT JOIN users mu ON mu.id = mm.user_id
     WHERE m.project_id = $1
     GROUP BY m.id, u.name, u.initials, u.color, t.title
     ORDER BY m.created_at ASC`,
    [projectId]
  );
  res.json(result.rows);
});

// POST /api/messages { projectId, body, taskRefId?, mentionUserIds? }
router.post("/", async (req, res) => {
  const { projectId, body, taskRefId, mentionUserIds = [] } = req.body;
  if (!projectId || !body?.trim()) {
    return res.status(400).json({ error: "projectId and body are required" });
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    const msgResult = await client.query(
      `INSERT INTO project_messages (project_id, author_id, body, task_ref_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [projectId, req.user.id, body.trim(), taskRefId || null]
    );
    const msg = msgResult.rows[0];

    // Resolve task title for the response
    let taskRefTitle = null;
    if (taskRefId) {
      const tr = await client.query("SELECT title FROM tasks WHERE id = $1", [taskRefId]);
      taskRefTitle = tr.rows[0]?.title || null;
    }

    // Insert mention rows and notify each mentioned user
    const mentionedUsers = [];
    for (const uid of [...new Set(mentionUserIds)]) {
      if (uid === req.user.id) continue; // don't notify yourself
      await client.query(
        "INSERT INTO message_mentions (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [msg.id, uid]
      );
      const uRow = await client.query("SELECT id, name FROM users WHERE id = $1", [uid]);
      if (uRow.rows.length > 0) mentionedUsers.push(uRow.rows[0]);
    }

    await client.query("COMMIT");

    // Build the full message object to broadcast
    const fullMsg = {
      ...msg,
      author_name: req.user.name,
      author_initials: null, // filled client-side from members list
      author_color: null,
      task_ref_title: taskRefTitle,
      mentions: mentionedUsers,
    };

    // Get author display info
    const authorRow = await db.query("SELECT initials, color FROM users WHERE id = $1", [req.user.id]);
    if (authorRow.rows.length > 0) {
      fullMsg.author_initials = authorRow.rows[0].initials;
      fullMsg.author_color = authorRow.rows[0].color;
    }

    // Emit to everyone in the project room
    emitToProject(projectId, "message:created", fullMsg);

    // Create notifications + real-time push for mentioned users
    for (const u of mentionedUsers) {
      const notifText = taskRefTitle
        ? `${req.user.name} mentioned you in chat (re: "${taskRefTitle}")`
        : `${req.user.name} mentioned you in the project chat`;
      const notifResult = await db.query(
        `INSERT INTO notifications (user_id, type, message, message_id)
         VALUES ($1, 'mention', $2, $3) RETURNING *`,
        [u.id, notifText, msg.id]
      );
      emitToUser(u.id, "notification:new", notifResult.rows[0]);
    }

    res.status(201).json(fullMsg);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to send message" });
  } finally {
    client.release();
  }
});

module.exports = router;
