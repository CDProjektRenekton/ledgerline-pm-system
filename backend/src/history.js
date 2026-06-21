const db = require("./db");

async function logHistory(taskId, actorId, action, detail) {
  await db.query(
    `INSERT INTO task_history (task_id, actor_id, action, detail) VALUES ($1, $2, $3, $4)`,
    [taskId, actorId || null, action, detail]
  );
}

module.exports = { logHistory };
