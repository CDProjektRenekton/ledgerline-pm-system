// Lightweight API client for the PM System backend.
// Set VITE_API_BASE in a .env file to point elsewhere (default: http://localhost:4000/api).
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000/api";

const TOKEN_KEY = "pm_token";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  register: (name, email, password) =>
    request("/auth/register", { method: "POST", body: { name, email, password } }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: { email, password } }),
  me: (token) => request("/auth/me", { token }),
  verifyEmail: (verifyToken) =>
    request("/auth/verify-email", { method: "POST", body: { token: verifyToken } }),
  resendVerification: (token) =>
    request("/auth/resend-verification", { method: "POST", token }),
  forgotPassword: (email) => request("/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (token, newPassword) =>
    request("/auth/reset-password", { method: "POST", body: { token, newPassword } }),

  searchUsers: (token, q) => request(`/auth/search-users?q=${encodeURIComponent(q)}`, { token }),

  listProjects: (token) => request("/projects", { token }),
  listArchivedProjects: (token) => request("/projects/archived", { token }),
  createProject: (token, name, description) =>
    request("/projects", { method: "POST", body: { name, description }, token }),
  archiveProject: (token, id, is_archived) =>
    request(`/projects/${id}`, { method: "PATCH", body: { is_archived }, token }),
  renameProject: (token, id, name, description) =>
    request(`/projects/${id}`, { method: "PATCH", body: { name, description }, token }),
  deleteProject: (token, id) => request(`/projects/${id}`, { method: "DELETE", token }),
  getProjectReport: (token, id) => request(`/projects/${id}/report`, { token }),

  listPendingInvites: (token) => request("/projects/invites/pending", { token }),
  acceptInvite: (token, inviteId) => request(`/projects/invites/${inviteId}/accept`, { method: "POST", token }),
  declineInvite: (token, inviteId) => request(`/projects/invites/${inviteId}/decline`, { method: "POST", token }),

  listTasks: (token, projectId) => request(`/tasks?projectId=${projectId}`, { token }),
  searchTasks: (token, projectId, q) => request(`/tasks/search?projectId=${projectId}&q=${encodeURIComponent(q)}`, { token }),
  createTask: (token, payload) => request("/tasks", { method: "POST", body: payload, token }),
  updateTask: (token, id, patch) => request(`/tasks/${id}`, { method: "PATCH", body: patch, token }),
  deleteTask: (token, id) => request(`/tasks/${id}`, { method: "DELETE", token }),
  taskHistory: (token, taskId) => request(`/tasks/${taskId}/history`, { token }),
  reorderTasks: (token, projectId, status, orderedIds) =>
    request("/tasks/reorder", { method: "POST", body: { projectId, status, orderedIds }, token }),

  listSubtasks: (token, taskId) => request(`/subtasks?taskId=${taskId}`, { token }),
  createSubtask: (token, taskId, title, targetAt) =>
    request("/subtasks", { method: "POST", body: { taskId, title, targetAt }, token }),
  updateSubtask: (token, id, patch) =>
    request(`/subtasks/${id}`, { method: "PATCH", body: patch, token }),
  deleteSubtask: (token, id) => request(`/subtasks/${id}`, { method: "DELETE", token }),

  listComments: (token, taskId) => request(`/comments?taskId=${taskId}`, { token }),
  addComment: (token, taskId, body) =>
    request("/comments", { method: "POST", body: { taskId, body }, token }),

  listMembers: (token, projectId) => request(`/projects/${projectId}/members`, { token }),
  inviteMember: (token, projectId, email) =>
    request(`/projects/${projectId}/members`, { method: "POST", body: { email }, token }),
  removeMember: (token, projectId, userId) =>
    request(`/projects/${projectId}/members/${userId}`, { method: "DELETE", token }),
  updateMemberRole: (token, projectId, userId, role) =>
    request(`/projects/${projectId}/members/${userId}/role`, { method: "PATCH", body: { role }, token }),

  listNotifications: (token) => request("/notifications", { token }),
  unreadNotificationCount: (token) => request("/notifications/unread-count", { token }),
  notificationCounts: (token) => request("/notifications/counts", { token }),
  markNotificationRead: (token, id) => request(`/notifications/${id}/read`, { method: "PATCH", token }),
  markAllNotificationsRead: (token) => request("/notifications/read-all", { method: "PATCH", token }),

  listMessages: (token, projectId) => request(`/messages?projectId=${projectId}`, { token }),
  sendMessage: (token, projectId, body, taskRefId, mentionUserIds) =>
    request("/messages", { method: "POST", body: { projectId, body, taskRefId, mentionUserIds }, token }),

  listTeams: (token, projectId) => request(`/teams?projectId=${projectId}`, { token }),
  createTeam: (token, projectId, name, color) =>
    request("/teams", { method: "POST", body: { projectId, name, color }, token }),
  deleteTeam: (token, id) => request(`/teams/${id}`, { method: "DELETE", token }),
  addTeamMember: (token, teamId, userId) =>
    request(`/teams/${teamId}/members`, { method: "POST", body: { userId }, token }),
  removeTeamMember: (token, teamId, userId) =>
    request(`/teams/${teamId}/members/${userId}`, { method: "DELETE", token }),

  listAttachments: (token, taskId) => request(`/attachments?taskId=${taskId}`, { token }),
  deleteAttachment: (token, id) => request(`/attachments/${id}`, { method: "DELETE", token }),
  uploadAttachment: async (token, taskId, file) => {
    const form = new FormData();
    form.append("taskId", taskId);
    form.append("file", file);
    const res = await fetch(`${API_BASE}/attachments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
    return data;
  },
};

export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

export default api;
