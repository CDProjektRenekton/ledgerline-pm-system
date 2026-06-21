const db = require("../db");
const { sendReminderEmail } = require("../email");
const { emitToUser } = require("../socket");

// Checks for tasks due within 24 hours or overdue, not yet done, and
// notifies whoever's responsible — a single assignee, or every member of
// an assigned team. Skips duplicate notifications for the same day.
async function checkDueDates() {
  const result = await db.query(
    `SELECT t.id, t.title, t.project_id, t.due_date, t.assignee_id, t.assignee_team_id, t.status,
            p.name AS project_name,
            (t.due_date < CURRENT_DATE) AS is_overdue
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     WHERE t.due_date IS NOT NULL
       AND t.status != 'done'
       AND t.due_date <= (CURRENT_DATE + INTERVAL '1 day')
       AND (t.assignee_id IS NOT NULL OR t.assignee_team_id IS NOT NULL)`
  );

  let notified = 0;

  for (const task of result.rows) {
    const type = task.is_overdue ? "overdue" : "due_soon";
    const message = task.is_overdue
      ? `Task "${task.title}" is overdue`
      : `Task "${task.title}" is due soon`;

    // Resolve recipients: either the single assignee, or every team member.
    let recipientIds = [];
    if (task.assignee_id) {
      recipientIds = [task.assignee_id];
    } else if (task.assignee_team_id) {
      const members = await db.query("SELECT user_id FROM team_members WHERE team_id = $1", [task.assignee_team_id]);
      recipientIds = members.rows.map((r) => r.user_id);
    }

    for (const userId of recipientIds) {
      const existing = await db.query(
        `SELECT id FROM notifications
         WHERE task_id = $1 AND user_id = $2 AND type = $3 AND created_at::date = CURRENT_DATE`,
        [task.id, userId, type]
      );
      if (existing.rows.length > 0) continue;

      const notifResult = await db.query(
        `INSERT INTO notifications (user_id, task_id, type, message) VALUES ($1, $2, $3, $4) RETURNING *`,
        [userId, task.id, type, message]
      );
      emitToUser(userId, "notification:new", notifResult.rows[0]);

      const userResult = await db.query("SELECT name, email FROM users WHERE id = $1", [userId]);
      if (userResult.rows.length > 0) {
        sendReminderEmail({
          to: userResult.rows[0].email,
          recipientName: userResult.rows[0].name,
          taskTitle: task.title,
          projectName: task.project_name,
          type,
        }).catch((err) => console.error("Reminder email failed:", err.message));
      }
      notified++;
    }
  }
  return notified;
}

function startScheduler(intervalMs = 1000 * 60 * 60) {
  // Run once on boot, then on an interval (default hourly)
  checkDueDates().catch((err) => console.error("Due-date check failed:", err));
  return setInterval(() => {
    checkDueDates().catch((err) => console.error("Due-date check failed:", err));
  }, intervalMs);
}

module.exports = { checkDueDates, startScheduler };
