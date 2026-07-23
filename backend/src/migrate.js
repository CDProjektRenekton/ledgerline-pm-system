// Applies schema.sql against DATABASE_URL. Safe to run repeatedly —
// every statement uses CREATE TABLE/INDEX IF NOT EXISTS.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { resolveSsl } = require("./db/ssl");

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "schema.sql"), "utf8");
  const connectionString = process.env.DATABASE_URL || "";
  const pool = new Pool({
    connectionString,
    ssl: resolveSsl(connectionString),
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
