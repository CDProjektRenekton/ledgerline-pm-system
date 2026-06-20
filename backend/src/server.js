require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");

const authRoutes = require("./routes/auth");
const projectRoutes = require("./routes/projects");
const taskRoutes = require("./routes/tasks");
const commentRoutes = require("./routes/comments");
const labelRoutes = require("./routes/labels");
const notificationRoutes = require("./routes/notifications");
const attachmentRoutes = require("./routes/attachments");
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

