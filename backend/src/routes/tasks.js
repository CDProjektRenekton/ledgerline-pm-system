const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { emitToProject, emitToUser } = require("../socket");
const { sendAssignmentEmail, sendStatusChangeEmail } = require("../email");
const { logHistory } = require("../history");

const router = express.Router();
router.use(requireAuth);

const STATUSES = ["todo", "inprogress", "review", "done"];
const PRIORITIES = ["low", "medium", "high"];
const STATUS_LABEL = { todo: "To Do", inprogress: "In Progress", review: "In Review", done: "Done" };

async function attachLabels(tasks) {
  if (tasks.length === 0) return tasks;
  const ids = tasks.map((t) => t.id);
  const result = await db.query(
    `SELECT tl.task_id, l.id, l.name, l.color
     FROM task_labels tl JOIN labels l ON l.id = tl.label_id
     WHERE tl.task_id = ANY($1::int[])`,
    [ids]
  );
  const byTask = {};
  for (const row of result.rows) {
    byTask[row.task_id] = byTask[row.task_id] || [];
    byTask[row.task_id].push({ id: row.id, name: row.name, color: row.color });
  }
  return tasks.map((t) => ({ ...t, labels: byTask[t.id] || [] }));
}

// Bundles each task's subtasks (id, title, is_done, target_at) so the
// frontend can plot them on Calendar/Timeline without extra round-trips.
async function attachSubtasks(tasks) {
  if (tasks.length === 0) return tasks;
  const ids = tasks.map((t) => t.id);
  const result = await db.query(
    `SELECT id, task_id, title, is_done, target_at FROM subtasks WHERE task_id = ANY($1::int[]) ORDER BY position, created_at`,
    [ids]
  );
  const byTask = {};
  for (const row of result.rows) {
    byTask[row.task_id] = byTask[row.task_id] || [];
    byTask[row.task_id].push(row);
  }
  return tasks.map((t) => ({ ...t, subtasks: byTask[t.id] || [] }));
}

// Records a notification row, pushes it over the socket to that user in
// real time, and fires an (async, non-blocking) assignment email.
async function notifyAssignment(userId, task, assignedByName) {
  const userResult = await db.query("SELECT name, email FROM users WHERE id = $1", [userId]);
  if (userResult.rows.length === 0) return;
  const user = userResult.rows[0];

  const message = `You were assigned: "${task.title}"`;
  const notifResult = await db.query(
    `INSERT INTO notifications (user_id, task_id, type, message) VALUES ($1,$2,'assigned',$3) RETURNING *`,
    [userId, task.id, message]
  );
  emitToUser(userId, "notification:new", notifResult.rows[0]);

  const projResult = await db.query("SELECT name FROM projects WHERE id = $1", [task.project_id]);
  const projectName = projResult.rows[0] ? projResult.rows[0].name : "a project";

  sendAssignmentEmail({
    to: user.email,
    recipientName: user.name,
    taskTitle: task.title,
    projectName,
    assignedByName,
  }).catch((err) => console.error("Assignment email failed:", err.message));
}

async function notifyTeamAssignment(teamId, task, assignedByName) {
  const members = await db.query("SELECT user_id FROM team_members WHERE team_id = $1", [teamId]);
  for (const row of members.rows) {
    await notifyAssignment(row.user_id, task, assignedByName);
  }
}

async function nameForUser(userId) {
  if (!userId) return null;
  const r = await db.query("SELECT name FROM users WHERE id = $1", [userId]);
  return r.rows[0] ? r.rows[0].name : "someone";
}
async function nameForTeam(teamId) {
  if (!teamId) return null;
  const r = await db.query("SELECT name FROM teams WHERE id = $1", [teamId]);
  return r.rows[0] ? r.rows[0].name : "a team";
}

// List tasks for a project (board view), with assignee/team + label info
router.get("/", async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ error: "projectId query param is required" });

  const result = await db.query(
    `SELECT t.*, 
            u.name AS assignee_name, u.initials AS assignee_initials, u.color AS assignee_color,
            tm.name AS team_name, tm.color AS team_color,
            (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) AS comment_count,
            (SELECT COUNT(*) FROM attachments a WHERE a.task_id = t.id) AS attachment_count
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assignee_id
     LEFT JOIN teams tm ON tm.id = t.assignee_team_id
     WHERE t.project_id = $1
     ORDER BY t.status, t.position, t.created_at`,
    [projectId]
  );
  let tasks = await attachLabels(result.rows);
  tasks = await attachSubtasks(tasks);
  res.json(tasks);
});

// Search tasks within a project using full-text search + title/description ilike fallback
router.get("/search", async (req, res) => {
  const { projectId, q } = req.query;
  if (!projectId) return res.status(400).json({ error: "projectId is required" });
  if (!q || !q.trim()) {
    // Empty query — return everything (same as the board list)
    const all = await db.query(
      `SELECT t.*, u.name AS assignee_name, u.initials AS assignee_initials, u.color AS assignee_color,
              tm.name AS team_name, tm.color AS team_color
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       LEFT JOIN teams tm ON tm.id = t.assignee_team_id
       WHERE t.project_id = $1 ORDER BY t.status, t.position, t.created_at`,
      [projectId]
    );
    return res.json(await attachLabels(all.rows));
  }
  const result = await db.query(
    `SELECT t.*, u.name AS assignee_name, u.initials AS assignee_initials, u.color AS assignee_color,
            tm.name AS team_name, tm.color AS team_color,
            ts_rank(t.search_vector, plainto_tsquery('english', $2)) AS rank
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assignee_id
     LEFT JOIN teams tm ON tm.id = t.assignee_team_id
     WHERE t.project_id = $1
       AND (t.search_vector @@ plainto_tsquery('english', $2)
            OR t.title ILIKE $3
            OR t.description ILIKE $3)
     ORDER BY rank DESC, t.status, t.position`,
    [projectId, q.trim(), `%${q.trim()}%`]
  );
  res.json(await attachLabels(result.rows));
});

// Create a task — assignee can be a single user (assigneeId) OR a team (assigneeTeamId), not both.
router.post("/", async (req, res) => {
  const { projectId, title, description, priority, assigneeId, assigneeTeamId, dueDate, startDate, category } = req.body;
  if (!projectId || !title) {
    return res.status(400).json({ error: "projectId and title are required" });
  }
  if (priority && !PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `priority must be one of ${PRIORITIES.join(", ")}` });
  }

  const finalAssigneeId = assigneeTeamId ? null : assigneeId || null;
  const finalTeamId = assigneeTeamId || null;

  const result = await db.query(
    `INSERT INTO tasks (project_id, title, description, priority, assignee_id, assignee_team_id, start_date, due_date, category)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [projectId, title, description || "", priority || "medium", finalAssigneeId, finalTeamId, startDate || null, dueDate || null, category || "simple"]
  );
  const task = result.rows[0];
  emitToProject(projectId, "task:created", task);

  await logHistory(task.id, req.user.id, "created", `${req.user.name} created this task`);
  if (finalAssigneeId) {
    const n = await nameForUser(finalAssigneeId);
    await logHistory(task.id, req.user.id, "assignee_changed", `Assigned to ${n}`);
  }
  if (finalTeamId) {
    const n = await nameForTeam(finalTeamId);
    await logHistory(task.id, req.user.id, "assignee_changed", `Assigned to team ${n}`);
  }

  if (finalAssigneeId) notifyAssignment(finalAssigneeId, task, req.user.name).catch(() => {});
  if (finalTeamId) notifyTeamAssignment(finalTeamId, task, req.user.name).catch(() => {});

  res.status(201).json(task);
});

// Full activity trail for a task: every status/priority/assignee/due-date
// change since creation, newest last.
router.get("/:id/history", async (req, res) => {
  const { id } = req.params;
  const result = await db.query(
    `SELECT h.*, u.name AS actor_name, u.initials AS actor_initials, u.color AS actor_color
     FROM task_history h LEFT JOIN users u ON u.id = h.actor_id
     WHERE h.task_id = $1 ORDER BY h.created_at ASC`,
    [id]
  );
  res.json(result.rows);
});

// Reorder tasks within (or into) a column. Body: { projectId, status, orderedIds: [id, ...] }
router.post("/reorder", async (req, res) => {
  const { projectId, status, orderedIds } = req.body;
  if (!projectId || !status || !Array.isArray(orderedIds)) {
    return res.status(400).json({ error: "projectId, status, and orderedIds[] are required" });
  }
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(", ")}` });
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        `UPDATE tasks SET position = $1, status = $2, updated_at = now() WHERE id = $3 AND project_id = $4`,
        [i, status, orderedIds[i], projectId]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ error: "Failed to reorder tasks" });
  } finally {
    client.release();
  }

  emitToProject(projectId, "tasks:reordered", { status, orderedIds });
  res.json({ ok: true });
});

// Update a task. Reads the existing row first so that an explicit `null`
// (e.g. unassigning) can be told apart from "field not included in this request".
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  if (body.status && !STATUSES.includes(body.status)) {
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(", ")}` });
  }
  if (body.priority && !PRIORITIES.includes(body.priority)) {
    return res.status(400).json({ error: `priority must be one of ${PRIORITIES.join(", ")}` });
  }

  const existingResult = await db.query("SELECT * FROM tasks WHERE id = $1", [id]);
  if (existingResult.rows.length === 0) return res.status(404).json({ error: "Task not found" });
  const existing = existingResult.rows[0];

  const next = {
    title: "title" in body ? body.title : existing.title,
    description: "description" in body ? body.description : existing.description,
    status: "status" in body ? body.status : existing.status,
    priority: "priority" in body ? body.priority : existing.priority,
    category: "category" in body ? body.category || "simple" : existing.category,
    start_date: "startDate" in body ? body.startDate || null : existing.start_date,
    due_date: "dueDate" in body ? body.dueDate || null : existing.due_date,
    position: "position" in body ? body.position : existing.position,
    assignee_id: existing.assignee_id,
    assignee_team_id: existing.assignee_team_id,
  };

  // Assigning a person clears any team assignment, and vice versa.
  if ("assigneeId" in body) {
    next.assignee_id = body.assigneeId || null;
    if (body.assigneeId) next.assignee_team_id = null;
  }
  if ("assigneeTeamId" in body) {
    next.assignee_team_id = body.assigneeTeamId || null;
    if (body.assigneeTeamId) next.assignee_id = null;
  }

  const result = await db.query(
    `UPDATE tasks SET
       title=$1, description=$2, status=$3, priority=$4,
       assignee_id=$5, assignee_team_id=$6, start_date=$7, due_date=$8, position=$9, category=$10, updated_at=now()
     WHERE id=$11 RETURNING *`,
    [next.title, next.description, next.status, next.priority, next.assignee_id, next.assignee_team_id, next.start_date, next.due_date, next.position, next.category, id]
  );

  const task = result.rows[0];
  emitToProject(task.project_id, "task:updated", task);

  // --- Activity trail: log every field that actually changed (with actor name) ---
  if ("title" in body && existing.title !== task.title) {
    await logHistory(task.id, req.user.id, "title_changed", `${req.user.name} renamed the task to "${task.title}"`);
  }
  if ("description" in body && existing.description !== task.description) {
    await logHistory(task.id, req.user.id, "description_changed", `${req.user.name} updated the description`);
  }
  if ("status" in body && existing.status !== task.status) {
    await logHistory(task.id, req.user.id, "status_changed", `${req.user.name} moved the task from "${STATUS_LABEL[existing.status]}" to "${STATUS_LABEL[task.status]}"`);
  }
  if ("priority" in body && existing.priority !== task.priority) {
    await logHistory(task.id, req.user.id, "priority_changed", `${req.user.name} changed priority from ${existing.priority} to ${task.priority}`);
  }
  if ("dueDate" in body && String(existing.due_date) !== String(task.due_date)) {
    const dateLabel = task.due_date ? new Date(task.due_date).toISOString().slice(0, 10) : null;
    await logHistory(task.id, req.user.id, "due_date_changed", dateLabel ? `${req.user.name} set due date to ${dateLabel}` : `${req.user.name} cleared the due date`);
  }
  if ("startDate" in body && String(existing.start_date) !== String(task.start_date)) {
    const dateLabel = task.start_date ? new Date(task.start_date).toISOString().slice(0, 10) : null;
    await logHistory(task.id, req.user.id, "start_date_changed", dateLabel ? `${req.user.name} set start date to ${dateLabel}` : `${req.user.name} cleared the start date`);
  }
  if ("category" in body && existing.category !== task.category) {
    await logHistory(task.id, req.user.id, "category_changed", `${req.user.name} changed category to ${task.category}`);
  }
  if (("assigneeId" in body && existing.assignee_id !== task.assignee_id) ||
      ("assigneeTeamId" in body && existing.assignee_team_id !== task.assignee_team_id)) {
    if (task.assignee_id) {
      const n = await nameForUser(task.assignee_id);
      await logHistory(task.id, req.user.id, "assignee_changed", `${req.user.name} assigned the task to ${n}`);
    } else if (task.assignee_team_id) {
      const n = await nameForTeam(task.assignee_team_id);
      await logHistory(task.id, req.user.id, "assignee_changed", `${req.user.name} assigned the task to team ${n}`);
    } else {
      await logHistory(task.id, req.user.id, "assignee_changed", `${req.user.name} unassigned the task`);
    }
  }

  // Status-change notification + email for whoever's assigned
  if (body.status && body.status !== existing.status) {
    const recipients = [];
    if (task.assignee_id) recipients.push(task.assignee_id);
    if (task.assignee_team_id) {
      const members = await db.query("SELECT user_id FROM team_members WHERE team_id = $1", [task.assignee_team_id]);
      members.rows.forEach((r) => recipients.push(r.user_id));
    }
    const projResult = await db.query("SELECT name FROM projects WHERE id = $1", [task.project_id]);
    const projectName = projResult.rows[0]?.name || "a project";

    for (const uid of recipients) {
      const notifResult = await db.query(
        `INSERT INTO notifications (user_id, task_id, type, message) VALUES ($1, $2, 'status_change', $3) RETURNING *`,
        [uid, task.id, `${req.user.name} moved "${task.title}" to ${STATUS_LABEL[body.status]}`]
      );
      emitToUser(uid, "notification:new", notifResult.rows[0]);

      // Don't email the person who made the change
      if (uid !== req.user.id) {
        const uRow = await db.query("SELECT name, email FROM users WHERE id = $1", [uid]);
        if (uRow.rows.length > 0) {
          sendStatusChangeEmail({
            to: uRow.rows[0].email,
            recipientName: uRow.rows[0].name,
            taskTitle: task.title,
            projectName,
            oldStatus: existing.status,
            newStatus: body.status,
            changedByName: req.user.name,
          }).catch((e) => console.error("Status-change email failed:", e.message));
        }
      }
    }
  }

  // New-assignment notification + email (only fires when the assignment actually changed)
  if ("assigneeId" in body && task.assignee_id && task.assignee_id !== existing.assignee_id) {
    notifyAssignment(task.assignee_id, task, req.user.name).catch(() => {});
  }
  if ("assigneeTeamId" in body && task.assignee_team_id && task.assignee_team_id !== existing.assignee_team_id) {
    notifyTeamAssignment(task.assignee_team_id, task, req.user.name).catch(() => {});
  }

  res.json(task);
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const existing = await db.query("SELECT project_id FROM tasks WHERE id = $1", [id]);
  const result = await db.query("DELETE FROM tasks WHERE id = $1 RETURNING id", [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Task not found" });
  if (existing.rows.length > 0) {
    emitToProject(existing.rows[0].project_id, "task:deleted", { id: Number(id) });
  }
  res.json({ ok: true });
});

// Attach / detach labels
router.post("/:id/labels/:labelId", async (req, res) => {
  const { id, labelId } = req.params;
  await db.query(
    `INSERT INTO task_labels (task_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [id, labelId]
  );
  res.status(201).json({ ok: true });
});

router.delete("/:id/labels/:labelId", async (req, res) => {
  const { id, labelId } = req.params;
  await db.query(`DELETE FROM task_labels WHERE task_id = $1 AND label_id = $2`, [id, labelId]);
  res.json({ ok: true });
});

module.exports = router;
