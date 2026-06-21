const { Pool } = require("pg");
require("dotenv").config();

// Render (and most managed Postgres hosts) require SSL on every connection,
// but a local/Docker Postgres on localhost does not support it.
// Auto-detect based on the host in DATABASE_URL.
const connectionString = process.env.DATABASE_URL || "";
const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
