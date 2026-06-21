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

  listProjects: (token) => request("/projects", { token }),
  createProject: (token, name, description) =>
    request("/projects", { method: "POST", body: { name, description }, token }),

  listTasks: (token, projectId) => request(`/tasks?projectId=${projectId}`, { token }),
  createTask: (token, payload) => request("/tasks", { method: "POST", body: payload, token }),
  updateTask: (token, id, patch) => request(`/tasks/${id}`, { method: "PATCH", body: patch, token }),
  deleteTask: (token, id) => request(`/tasks/${id}`, { method: "DELETE", token }),

  listComments: (token, taskId) => request(`/comments?taskId=${taskId}`, { token }),
  addComment: (token, taskId, body) =>
    request("/comments", { method: "POST", body: { taskId, body }, token }),

  listMembers: (token, projectId) => request(`/projects/${projectId}/members`, { token }),
  listNotifications: (token) => request("/notifications", { token }),

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
