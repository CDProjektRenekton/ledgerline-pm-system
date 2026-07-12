require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");

// --- Global crash-safety net ---
// Express 4 does NOT forward errors thrown inside async route handlers to the
// error-handling middleware automatically. Without this, any unexpected DB
// error (a missing table, a bad constraint, a network blip) becomes an
// unhandled promise rejection that takes down the ENTIRE server process —
// which then drops every open connection (all API calls fail with "Failed to
// fetch" and every socket disconnects). These handlers log the error and keep
// the server alive so a single failed request never affects anyone else.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection (server stays up):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception (server stays up):", err);
});

const authRoutes = require("./routes/auth");
const projectRoutes = require("./routes/projects");
const taskRoutes = require("./routes/tasks");
const commentRoutes = require("./routes/comments");
const labelRoutes = require("./routes/labels");
const notificationRoutes = require("./routes/notifications");
const attachmentRoutes = require("./routes/attachments");
const teamRoutes = require("./routes/teams");
const subtaskRoutes = require("./routes/subtasks");
const messageRoutes = require("./routes/messages");
const linkRoutes    = require("./routes/links");
const { startScheduler } = require("./jobs/dueDateScheduler");
const socket = require("./socket");

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/labels", labelRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/attachments", attachmentRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/subtasks", subtaskRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/links",    linkRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const server = http.createServer(app);
socket.init(server, process.env.CORS_ORIGIN || "*");

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`PM System API listening on port ${PORT}`);
  startScheduler();
});

