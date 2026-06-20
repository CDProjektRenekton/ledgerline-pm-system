const db = require("../db");

// Checks for tasks due within 24 hours or overdue, not yet done,
// and creates a notification for the assignee (skips duplicates for the same day).
async function checkDueDates() {
  const result = await db.query(
    `SELECT t.id, t.title, t.due_date, t.assignee_id, t.status,
            (t.due_date < CURRENT_DATE) AS is_overdue
     FROM tasks t
     WHERE t.due_date IS NOT NULL
       AND t.status != 'done'
       AND t.due_date <= (CURRENT_DATE + INTERVAL '1 day')
       AND t.assignee_id IS NOT NULL`
  );

  for (const task of result.rows) {
    const type = task.is_overdue ? "overdue" : "due_soon";
    const message = task.is_overdue
      ? `Task "${task.title}" is overdue`
      : `Task "${task.title}" is due soon`;

    const existing = await db.query(
      `SELECT id FROM notifications
       WHERE task_id = $1 AND type = $2 AND created_at::date = CURRENT_DATE`,
      [task.id, type]
    );
    if (existing.rows.length === 0) {
      await db.query(
        `INSERT INTO notifications (user_id, task_id, type, message) VALUES ($1, $2, $3, $4)`,
        [task.assignee_id, task.id, type, message]
      );
    }
  }
  return result.rows.length;
}

function startScheduler(intervalMs = 1000 * 60 * 60) {
  // Run once on boot, then on an interval (default hourly)
  checkDueDates().catch((err) => console.error("Due-date check failed:", err));
  return setInterval(() => {
    checkDueDates().catch((err) => console.error("Due-date check failed:", err));
  }, intervalMs);
}

module.exports = { checkDueDates, startScheduler };
