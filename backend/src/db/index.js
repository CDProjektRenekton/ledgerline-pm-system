const { Pool } = require("pg");
require("dotenv").config();
const { resolveSsl } = require("./ssl");

// Render (and most managed Postgres hosts) require SSL on every connection,
// but a local/Docker Postgres on localhost does not support it.
// See ./ssl.js for the full detection logic (and the DATABASE_SSL override).
const connectionString = process.env.DATABASE_URL || "";

const pool = new Pool({
  connectionString,
  ssl: resolveSsl(connectionString),
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
