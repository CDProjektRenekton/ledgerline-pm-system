// Applies schema.sql against DATABASE_URL. Safe to run repeatedly —
// every statement uses CREATE TABLE/INDEX IF NOT EXISTS.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "schema.sql"), "utf8");
  const connectionString = process.env.DATABASE_URL || "";
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  try {
    await pool.query(sql);
    console.log("✓ Schema applied");
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
