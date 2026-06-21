// Tiny singleton wrapper so any route file can emit real-time events
// without circular-importing the main server module.
let ioInstance = null;

function init(server, corsOrigin) {
  const { Server } = require("socket.io");
  ioInstance = new Server(server, {
    cors: { origin: corsOrigin || "*" },
  });

  ioInstance.on("connection", (socket) => {
    socket.on("join-project", (projectId) => {
      socket.join(`project:${projectId}`);
    });
    socket.on("leave-project", (projectId) => {
      socket.leave(`project:${projectId}`);
    });
    socket.on("join-user", (userId) => {
      socket.join(`user:${userId}`);
    });
  });

  return ioInstance;
}

function emitToProject(projectId, event, payload) {
  if (!ioInstance) return;
  ioInstance.to(`project:${projectId}`).emit(event, payload);
}

function emitToUser(userId, event, payload) {
  if (!ioInstance) return;
  ioInstance.to(`user:${userId}`).emit(event, payload);
}

module.exports = { init, emitToProject, emitToUser };
