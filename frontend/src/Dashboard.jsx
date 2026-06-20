import React, { useEffect, useRef, useState } from "react";
import {
  Plus,
  Search,
  X,
  MessageSquare,
  Paperclip,
  Calendar,
  LayoutGrid,
  List,
  CalendarDays,
  GanttChartSquare,
  LogOut,
  Upload,
  Trash2,
} from "lucide-react";
import { io } from "socket.io-client";
import { api, API_ORIGIN } from "./api";
import ListView from "./ListView.jsx";
import CalendarView from "./CalendarView.jsx";
import TimelineView from "./TimelineView.jsx";

const COLUMNS = [
  { id: "todo", label: "To Do", no: "01", accent: "#8B8680" },
  { id: "inprogress", label: "In Progress", no: "02", accent: "#1F6F78" },
  { id: "review", label: "In Review", no: "03", accent: "#C9A227" },
  { id: "done", label: "Done", no: "04", accent: "#3F7D52" },
];

const PRIORITY_COLOR = { high: "#9C4221", medium: "#C9A227", low: "#5C7A89" };

function formatDue(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Dashboard({ token, user, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeView, setActiveView] = useState("kanban");
  const [selectedTask, setSelectedTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [quickAdd, setQuickAdd] = useState({});
  const [newProjectName, setNewProjectName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const dragTaskId = useRef(null);
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);

  // Real-time connection: join the active project's room and react to
  // task/comment events from other clients (or other browser tabs).
  useEffect(() => {
    const socket = io(API_ORIGIN, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("task:created", (task) => {
      setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev : [...prev, { ...task, labels: [] }]));
    });
    socket.on("task:updated", (task) => {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...task } : t)));
      setSelectedTask((cur) => (cur && cur.id === task.id ? { ...cur, ...task } : cur));
    });
    socket.on("task:deleted", ({ id }) => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    });
    socket.on("comment:created", ({ taskId, comment }) => {
      setSelectedTask((cur) => {
        if (cur && cur.id === taskId) {
          setComments((prevComments) =>
            prevComments.some((c) => c.id === comment.id) ? prevComments : [...prevComments, comment]
          );
        }
        return cur;
      });
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (!activeProject || !socketRef.current) return;
    socketRef.current.emit("join-project", activeProject.id);
    return () => socketRef.current && socketRef.current.emit("leave-project", activeProject.id);
  }, [activeProject]);

  // Load projects on mount
  useEffect(() => {
    (async () => {
      try {
        const projs = await api.listProjects(token);
        setProjects(projs);
        if (projs.length > 0) setActiveProject(projs[0]);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // Load tasks + members whenever the active project changes
  useEffect(() => {
    if (!activeProject) return;
    (async () => {
      try {
        const [taskList, memberList] = await Promise.all([
          api.listTasks(token, activeProject.id),
          api.listMembers(token, activeProject.id),
        ]);
        setTasks(taskList);
        setMembers(memberList);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [activeProject, token]);

  // Load comments + attachments when a task is opened
  useEffect(() => {
    if (!selectedTask) {
      setComments([]);
      setAttachments([]);
      return;
    }
    (async () => {
      try {
        const [c, a] = await Promise.all([
          api.listComments(token, selectedTask.id),
          api.listAttachments(token, selectedTask.id),
        ]);
        setComments(c);
        setAttachments(a);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [selectedTask, token]);

  const refreshTasks = async () => {
    if (!activeProject) return;
    const taskList = await api.listTasks(token, activeProject.id);
    setTasks(taskList);
  };

  const moveTask = async (id, status) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t))); // optimistic
    try {
      await api.updateTask(token, id, { status });
    } catch (err) {
      setError(err.message);
      refreshTasks();
    }
  };

  const addTask = async (status, title) => {
    if (!title.trim() || !activeProject) return;
    try {
      await api.createTask(token, { projectId: activeProject.id, title: title.trim() });
      setQuickAdd((q) => ({ ...q, [status]: "" }));
      refreshTasks();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteTask = async (id) => {
    try {
      await api.deleteTask(token, id);
      setSelectedTask(null);
      refreshTasks();
    } catch (err) {
      setError(err.message);
    }
  };

  const patchTask = async (id, patch) => {
    setSelectedTask((cur) => (cur && cur.id === id ? { ...cur, ...patch } : cur));
    try {
      const updated = await api.updateTask(token, id, patch);
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
    } catch (err) {
      setError(err.message);
      refreshTasks();
    }
  };

  const postComment = async () => {
    if (!newComment.trim() || !selectedTask) return;
    try {
      await api.addComment(token, selectedTask.id, newComment.trim());
      setNewComment("");
      const c = await api.listComments(token, selectedTask.id);
      setComments(c);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedTask) return;
    setUploading(true);
    try {
      await api.uploadAttachment(token, selectedTask.id, file);
      const a = await api.listAttachments(token, selectedTask.id);
      setAttachments(a);
      refreshTasks();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeAttachment = async (id) => {
    try {
      await api.deleteAttachment(token, id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      refreshTasks();
    } catch (err) {
      setError(err.message);
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const proj = await api.createProject(token, newProjectName.trim(), "");
      setNewProjectName("");
      setProjects((prev) => [proj, ...prev]);
      setActiveProject(proj);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif" }}>Loading workspace…</div>;
  }

  return (
    <div className="pm-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        .pm-root {
          --ink: #1B1B1F; --paper: #F6F2E9; --paper-deep: #EFE9DA; --card: #FFFFFF;
          --muted: #8B8680; --border: #E4DFD3; --teal: #1F6F78; --teal-deep: #16545B; --gold: #C9A227;
          font-family: 'Inter', sans-serif; color: var(--ink); background: var(--paper);
          height: 100vh; display: flex; overflow: hidden;
        }
        .pm-serif { font-family: 'Fraunces', serif; }
        .pm-mono { font-family: 'JetBrains Mono', monospace; }
        .pm-sidebar { width: 240px; flex-shrink: 0; background: var(--ink); color: #EDEAE2; display: flex; flex-direction: column; }
        .pm-sidebar-brand { padding: 22px 20px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); display:flex; align-items:center; gap:10px; }
        .pm-sidebar-brand .mark { width: 30px; height: 30px; border-radius: 7px; background: linear-gradient(135deg, var(--gold), #E3C25C); display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-weight: 700; color: #1B1B1F; font-size: 15px; }
        .pm-sidebar-section { padding: 16px 20px 6px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #8E8B83; }
        .pm-proj-item { margin: 2px 12px; padding: 9px 12px; border-radius: 8px; font-size: 13.5px; display: flex; align-items: center; gap: 9px; cursor: pointer; color: #D8D5CC; }
        .pm-proj-item.active { background: rgba(255,255,255,0.08); color: #fff; }
        .pm-proj-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink:0; }
        .pm-proj-add { display:flex; gap:6px; margin: 8px 12px; }
        .pm-proj-add input { flex:1; min-width:0; background: rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#fff; border-radius:6px; padding:6px 8px; font-size:12px; outline:none; }
        .pm-proj-add button { background: var(--gold); border:none; border-radius:6px; padding: 0 9px; cursor:pointer; font-weight:700; }
        .pm-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .pm-topbar { padding: 18px 28px 0; background: var(--paper); }
        .pm-topbar-row1 { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .pm-title { font-size: 23px; font-weight: 600; }
        .pm-title .ruleline { display: block; width: 46px; height: 3px; background: var(--gold); margin-top: 6px; border-radius: 2px; }
        .pm-search { display: flex; align-items: center; gap: 8px; background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 7px 12px; width: 200px; color: var(--muted); font-size: 13px; }
        .pm-search input { border: none; outline: none; background: transparent; width: 100%; font-size: 13px; }
        .pm-avatars { display: flex; }
        .pm-avatar { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 11.5px; font-weight: 600; border: 2px solid var(--paper); margin-left: -8px; }
        .pm-btn-primary { display: flex; align-items: center; gap: 6px; background: var(--teal); color: white; border: none; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .pm-btn-primary:hover { background: var(--teal-deep); }
        .pm-btn-ghost { display:flex; align-items:center; gap:6px; background:transparent; border:1px solid var(--border); color: var(--ink); padding: 8px 12px; border-radius: 8px; font-size: 12.5px; cursor:pointer; }
        .pm-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--border); }
        .pm-tab { display: flex; align-items: center; gap: 6px; padding: 9px 14px; font-size: 13px; color: var(--muted); border-bottom: 2px solid transparent; cursor: pointer; }
        .pm-tab.active { color: var(--ink); border-bottom: 2px solid var(--gold); font-weight: 600; }
        .pm-board { flex: 1; display: flex; gap: 16px; padding: 18px 28px 22px; overflow-x: auto; }
        .pm-col { width: 270px; flex-shrink: 0; display: flex; flex-direction: column; background: var(--paper-deep); border-radius: 12px; padding: 10px; max-height: 100%; }
        .pm-col.dragover { outline: 2px dashed var(--gold); outline-offset: -4px; }
        .pm-col-head { display: flex; align-items: center; justify-content: space-between; padding: 6px 6px 10px; }
        .pm-col-head-left { display: flex; align-items: baseline; gap: 7px; }
        .pm-col-no { font-size: 10.5px; color: var(--muted); }
        .pm-col-label { font-size: 13.5px; font-weight: 700; }
        .pm-col-count { font-size: 11px; color: var(--muted); background: var(--card); border-radius: 999px; padding: 1px 7px; }
        .pm-col-bar { height: 3px; border-radius: 2px; margin: 0 6px 10px; }
        .pm-cards { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 9px; padding: 0 2px 4px; }
        .pm-card { background: var(--card); border-radius: 10px; padding: 11px 12px 10px; box-shadow: 0 1px 2px rgba(27,27,31,0.06); border: 1px solid var(--border); cursor: grab; position: relative; }
        .pm-card:hover { border-color: #cfc8b4; }
        .pm-flag { position: absolute; top: 0; right: 12px; width: 10px; height: 16px; clip-path: polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%); }
        .pm-card-title { font-size: 13.5px; font-weight: 600; line-height: 1.35; margin-bottom: 8px; padding-right: 14px; }
        .pm-labels { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 9px; }
        .pm-label-chip { font-size: 10px; padding: 2px 7px; border-radius: 5px; background: #EEE9DC; color: #5C5747; font-weight: 600; }
        .pm-card-foot { display: flex; align-items: center; justify-content: space-between; }
        .pm-card-meta { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 11px; }
        .pm-card-meta-item { display: flex; align-items: center; gap: 3px; }
        .pm-card-avatar { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 9.5px; font-weight: 700; }
        .pm-quickadd { padding: 4px 2px 2px; }
        .pm-quickadd input { width: 100%; box-sizing:border-box; border: 1px dashed var(--border); background: transparent; border-radius: 8px; padding: 8px 10px; font-size: 12.5px; outline: none; }
        .pm-quickadd input:focus { border-color: var(--gold); background: var(--card); }
        .pm-overlay { position: fixed; inset: 0; background: rgba(27,27,31,0.32); display: flex; justify-content: flex-end; z-index: 50; }
        .pm-panel { width: 420px; max-width: 92vw; height: 100%; background: var(--card); padding: 22px 24px; overflow-y: auto; box-shadow: -8px 0 24px rgba(0,0,0,0.12); }
        .pm-panel-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
        .pm-panel-close { cursor: pointer; color: var(--muted); }
        .pm-panel-title { width: 100%; box-sizing:border-box; font-size: 18px; font-weight: 700; border: none; outline: none; font-family: 'Fraunces', serif; resize: none; margin-bottom: 14px; }
        .pm-field-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 5px; margin-top: 16px; }
        .pm-select, .pm-textarea, .pm-dateinput { width: 100%; box-sizing:border-box; border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 13px; font-family: 'Inter', sans-serif; outline: none; }
        .pm-textarea { resize: vertical; min-height: 64px; }
        .pm-delete-btn { margin-top: 22px; color: #9C4221; font-size: 12.5px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; }
        .pm-comment { border-top: 1px solid var(--border); padding: 10px 0; }
        .pm-comment-head { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
        .pm-comment-avatar { width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-size:9px; font-weight:700; }
        .pm-comment-name { font-size:12px; font-weight:600; }
        .pm-comment-time { font-size:10.5px; color:var(--muted); }
        .pm-comment-body { font-size: 13px; line-height:1.5; }
        .pm-comment-add { display:flex; gap:8px; margin-top:10px; }
        .pm-comment-add input { flex:1; border:1px solid var(--border); border-radius:8px; padding:8px 10px; font-size:12.5px; outline:none; }
        .pm-attachment { display:flex; align-items:center; justify-content:space-between; padding: 6px 9px; background: var(--paper-deep); border-radius: 7px; margin-bottom: 6px; }
        .pm-attachment-link { display:flex; align-items:center; gap:6px; font-size: 12px; color: var(--ink); text-decoration:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .pm-attachment-del { cursor:pointer; color: var(--muted); flex-shrink:0; }
        .pm-attachment-del:hover { color: #9C4221; }
        .pm-error-banner { background:#FBEAE2; color:#9C4221; padding:8px 28px; font-size:12.5px; }
      `}</style>

      <aside className="pm-sidebar">
        <div className="pm-sidebar-brand">
          <div className="mark">L</div>
          <div>
            <div className="pm-serif" style={{ fontSize: 14.5, fontWeight: 600 }}>Ledgerline</div>
            <div style={{ fontSize: 10.5, color: "#9B988F" }}>Project Workspace</div>
          </div>
        </div>

        <div className="pm-sidebar-section">Projects</div>
        {projects.map((p) => (
          <div
            key={p.id}
            className={`pm-proj-item ${activeProject && activeProject.id === p.id ? "active" : ""}`}
            onClick={() => setActiveProject(p)}
          >
            <span className="pm-proj-dot" style={{ background: "#C9A227" }} />
            {p.name}
          </div>
        ))}
        <div className="pm-proj-add">
          <input
            placeholder="New project…"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createProject()}
          />
          <button onClick={createProject}>+</button>
        </div>

        <div style={{ marginTop: "auto", padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 9 }}>
          <div className="pm-avatar" style={{ background: user.color, marginLeft: 0, border: "none" }}>{user.initials}</div>
          <div style={{ fontSize: 12.5, flex: 1 }}>{user.name}</div>
          <LogOut size={15} style={{ cursor: "pointer", color: "#9B988F" }} onClick={onLogout} />
        </div>
      </aside>

      <div className="pm-main">
        {error && <div className="pm-error-banner">{error} <span style={{cursor:"pointer", fontWeight:600}} onClick={() => setError("")}> Dismiss</span></div>}
        <div className="pm-topbar">
          <div className="pm-topbar-row1">
            <div className="pm-title pm-serif">
              {activeProject ? activeProject.name : "No project selected"}
              <span className="ruleline" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div className="pm-search">
                <Search size={14} />
                <input placeholder="Search tasks…" />
              </div>
              <div className="pm-avatars">
                {members.map((m) => (
                  <div key={m.id} className="pm-avatar" style={{ background: m.color }} title={m.name}>{m.initials}</div>
                ))}
              </div>
              <button className="pm-btn-primary" onClick={() => addTask("todo", "New task")} disabled={!activeProject}>
                <Plus size={15} /> New Task
              </button>
            </div>
          </div>

          <div className="pm-tabs">
            <div className={`pm-tab ${activeView === "kanban" ? "active" : ""}`} onClick={() => setActiveView("kanban")}><LayoutGrid size={14} /> Kanban</div>
            <div className={`pm-tab ${activeView === "list" ? "active" : ""}`} onClick={() => setActiveView("list")}><List size={14} /> List</div>
            <div className={`pm-tab ${activeView === "calendar" ? "active" : ""}`} onClick={() => setActiveView("calendar")}><CalendarDays size={14} /> Calendar</div>
            <div className={`pm-tab ${activeView === "timeline" ? "active" : ""}`} onClick={() => setActiveView("timeline")}><GanttChartSquare size={14} /> Timeline</div>
          </div>
        </div>

        {!activeProject ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
            Create a project to get started.
          </div>
        ) : activeView === "kanban" ? (
          <div className="pm-board">
            {COLUMNS.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col.id);
              return (
                <div
                  key={col.id}
                  className={`pm-col ${dragOverCol === col.id ? "dragover" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id); }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={() => { if (dragTaskId.current) moveTask(dragTaskId.current, col.id); setDragOverCol(null); }}
                >
                  <div className="pm-col-head">
                    <div className="pm-col-head-left">
                      <span className="pm-col-no pm-mono">{col.no}</span>
                      <span className="pm-col-label">{col.label}</span>
                    </div>
                    <span className="pm-col-count">{colTasks.length}</span>
                  </div>
                  <div className="pm-col-bar" style={{ background: col.accent }} />

                  <div className="pm-cards">
                    {colTasks.map((t) => (
                      <div key={t.id} className="pm-card" draggable onDragStart={() => (dragTaskId.current = t.id)} onClick={() => setSelectedTask(t)}>
                        <div className="pm-flag" style={{ background: PRIORITY_COLOR[t.priority] }} title={`${t.priority} priority`} />
                        <div className="pm-card-title">{t.title}</div>
                        {t.labels && t.labels.length > 0 && (
                          <div className="pm-labels">
                            {t.labels.map((l) => <span className="pm-label-chip" key={l.id}>{l.name}</span>)}
                          </div>
                        )}
                        <div className="pm-card-foot">
                          <div className="pm-card-meta">
                            {t.due_date && <span className="pm-card-meta-item"><Calendar size={11} /> {formatDue(t.due_date)}</span>}
                            {Number(t.comment_count) > 0 && <span className="pm-card-meta-item"><MessageSquare size={11} /> {t.comment_count}</span>}
                            {Number(t.attachment_count) > 0 && <span className="pm-card-meta-item"><Paperclip size={11} /> {t.attachment_count}</span>}
                          </div>
                          {t.assignee_initials && (
                            <div className="pm-card-avatar" style={{ background: t.assignee_color }}>{t.assignee_initials}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pm-quickadd">
                    <input
                      placeholder="+ Add a task…"
                      value={quickAdd[col.id] || ""}
                      onChange={(e) => setQuickAdd((q) => ({ ...q, [col.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") addTask(col.id, quickAdd[col.id] || ""); }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : activeView === "list" ? (
          <ListView tasks={tasks} onSelect={setSelectedTask} />
        ) : activeView === "calendar" ? (
          <CalendarView tasks={tasks} onSelect={setSelectedTask} />
        ) : activeView === "timeline" ? (
          <TimelineView tasks={tasks} onSelect={setSelectedTask} />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 14 }}>
            {activeView.charAt(0).toUpperCase() + activeView.slice(1)} view — coming next.
          </div>
        )}
      </div>

      {selectedTask && (
        <div className="pm-overlay" onClick={() => setSelectedTask(null)}>
          <div className="pm-panel" onClick={(e) => e.stopPropagation()}>
            <div className="pm-panel-head">
              <span className="pm-mono" style={{ fontSize: 11, color: "var(--muted)" }}>TASK-{selectedTask.id}</span>
              <X size={18} className="pm-panel-close" onClick={() => setSelectedTask(null)} />
            </div>
            <textarea className="pm-panel-title" rows={2} value={selectedTask.title} onChange={(e) => patchTask(selectedTask.id, { title: e.target.value })} />

            <div className="pm-field-label">Description</div>
            <textarea className="pm-textarea" value={selectedTask.description || ""} placeholder="Add a description…" onChange={(e) => patchTask(selectedTask.id, { description: e.target.value })} />

            <div className="pm-field-label">Status</div>
            <select className="pm-select" value={selectedTask.status} onChange={(e) => patchTask(selectedTask.id, { status: e.target.value })}>
              {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>

            <div className="pm-field-label">Priority</div>
            <select className="pm-select" value={selectedTask.priority} onChange={(e) => patchTask(selectedTask.id, { priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>

            <div className="pm-field-label">Assignee</div>
            <select
              className="pm-select"
              value={selectedTask.assignee_id || ""}
              onChange={(e) => patchTask(selectedTask.id, { assigneeId: Number(e.target.value) || null })}
            >
              <option value="">Unassigned</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>

            <div className="pm-field-label">Due date</div>
            <input type="date" className="pm-dateinput" value={selectedTask.due_date ? selectedTask.due_date.slice(0, 10) : ""} onChange={(e) => patchTask(selectedTask.id, { dueDate: e.target.value })} />

            <div className="pm-field-label">Attachments</div>
            {attachments.map((a) => (
              <div className="pm-attachment" key={a.id}>
                <a href={`${API_ORIGIN}${a.url}`} target="_blank" rel="noreferrer" className="pm-attachment-link">
                  <Paperclip size={12} /> {a.filename}
                </a>
                <Trash2 size={13} className="pm-attachment-del" onClick={() => removeAttachment(a.id)} />
              </div>
            ))}
            <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleFileSelected} />
            <div className="pm-btn-ghost" style={{ marginTop: 8, width: "fit-content" }} onClick={() => fileInputRef.current && fileInputRef.current.click()}>
              <Upload size={13} /> {uploading ? "Uploading…" : "Upload file"}
            </div>

            <div className="pm-field-label">Comments</div>
            {comments.map((c) => (
              <div className="pm-comment" key={c.id}>
                <div className="pm-comment-head">
                  <div className="pm-comment-avatar" style={{ background: c.author_color }}>{c.author_initials}</div>
                  <span className="pm-comment-name">{c.author_name}</span>
                  <span className="pm-comment-time">{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <div className="pm-comment-body">{c.body}</div>
              </div>
            ))}
            <div className="pm-comment-add">
              <input placeholder="Write a comment…" value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && postComment()} />
              <button className="pm-btn-primary" onClick={postComment}>Post</button>
            </div>

            <div className="pm-delete-btn" onClick={() => deleteTask(selectedTask.id)}>
              <X size={13} /> Delete task
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
