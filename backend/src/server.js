require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const http = require("http");
const path = require("path");
const { generalLimiter, authLimiter } = require("./middleware/rateLimit");

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
const adminRoutes   = require("./routes/admin");
const { startScheduler } = require("./jobs/dueDateScheduler");
const socket = require("./socket");

const app = express();

// Security headers. CSP is tuned for how this app is actually built rather
// than left at helmet's strict defaults, which would break it:
// - style-src needs 'unsafe-inline' because the frontend uses CSS-in-JS
//   (template-literal <style> blocks per component), not external stylesheets.
// - img-src allows https: for the MWSS logo images and any attachment
//   thumbnails, which are hosted externally.
// - crossOriginEmbedderPolicy/crossOriginResourcePolicy are relaxed off
//   helmet's defaults, which would otherwise block those same external
//   images from loading at all.
// - upgradeInsecureRequests is explicitly disabled: Helmet adds this CSP
//   directive by default, which tells the browser to silently retry every
//   asset over HTTPS instead of HTTP. This app is deployed over plain HTTP
//   in most setups (LAN IP, Podman/native Windows, no TLS cert) — with the
//   directive left on, the browser tries HTTPS against a server that only
//   speaks HTTP, gets a connection reset, and the page renders blank.
//   Browsers exempt "localhost" from this behavior (treated as a secure
//   context already), which is why this doesn't show up when testing from
//   the same machine — only when accessed via a real LAN IP or domain over
//   plain HTTP. If this app is later served over real HTTPS (e.g. behind
//   the Cloudflare Tunnel), this directive being off changes nothing, since
//   there's no insecure HTTP request to "upgrade" in the first place.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.use("/api", generalLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
app.use("/api/auth/verify-email", authLimiter);
app.use("/api/auth/resend-verification", authLimiter);

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
app.use("/api/admin",    adminRoutes);

// --- Optional single-process local deployment ---
// On Render, frontend and backend run as two separate services, so
// ../../frontend/dist never exists inside the backend service and none of
// this runs — the split cloud deployment is completely unaffected.
// For an office running everything on one local machine (no Render, no
// separate static host), building the frontend and starting only this
// backend process serves the whole app — API + UI — from a single port,
// which is far simpler to firewall and keep running on a LAN. See
// LOCAL_LAN_DEPLOYMENT.md for the full setup.
const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");
if (require("fs").existsSync(frontendDist)) {
  console.log("Serving built frontend from", frontendDist);
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

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

