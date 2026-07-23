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
  Users,
  UserCog,
  Clock,
  Archive,
  CheckSquare,
  Square,
  RotateCw,
  Flag,
  User,
  Tag,
  Edit2,
  FileText,
  Mail,
  Check,
  Download,
  FileUp,
} from "lucide-react";
import { io } from "socket.io-client";
import { api, API_ORIGIN } from "./api";
import ListView from "./ListView.jsx";
import CalendarView from "./CalendarView.jsx";
import TimelineView from "./TimelineView.jsx";
import TeamsPanel from "./TeamsPanel.jsx";
import MembersPanel from "./MembersPanel.jsx";
import NotificationBell from "./NotificationBell.jsx";
import ChatPanel from "./ChatPanel.jsx";
import AdminPanel from "./AdminPanel.jsx";
import { csvToTaskRows } from "./csv.js";
import { getThemeVars, THEME_LABELS, THEME_ORDER } from "./themes.js";
import { toLocalInputValue, fromLocalInputValue } from "./datetime.js";

const COLUMNS = [
  { id: "todo",       label: "To Do",       no: "01", accent: "#6B92AD" },
  { id: "inprogress", label: "In Progress",  no: "02", accent: "#1A7FA8" },
  { id: "review",     label: "In Review",    no: "03", accent: "#F59E0B" },
  { id: "done",       label: "Done",         no: "04", accent: "#10B981" },
];

const STATUS_LABELS = { todo: "To Do", inprogress: "In Progress", review: "In Review", done: "Done" };
const STATUS_COLORS = { todo: "#6B92AD", inprogress: "#1A7FA8", review: "#F59E0B", done: "#10B981" };
const PRIORITY_COLOR = { high: "#EF4444", medium: "#F59E0B", low: "#6B92AD" };

function formatDue(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Dashboard({ token, user, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [showTeamsPanel, setShowTeamsPanel] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedProjects, setArchivedProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null); // null = not searching
  const [tasks, setTasks] = useState([]);
  const [activeView, setActiveView] = useState("kanban");
  const [selectedTask, setSelectedTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState("");
  // Save-button state: track unsaved edits to title/description separately
  // so we only write to the DB (and activity log) when the user explicitly saves.
  const [editTitle, setEditTitle] = useState(null);   // null = not editing
  const [editDesc, setEditDesc] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [quickAdd, setQuickAdd] = useState({});
  const [newProjectName, setNewProjectName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [taskUnreadCounts, setTaskUnreadCounts] = useState({});   // { taskId: n }
  const [projectUnreadCounts, setProjectUnreadCounts] = useState({}); // { projectId: n }
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  // Sidebar resize / collapse
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // New project modal
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [newProjDesc, setNewProjDesc] = useState("");
  // New task modal
  const [showNewTask, setShowNewTask] = useState(false);
  const [showImportTasks, setShowImportTasks] = useState(false);
  const [importRows, setImportRows] = useState([]);       // parsed rows awaiting import
  const [importFileName, setImportFileName] = useState("");
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null); // { createdCount, errors, warnings }
  const importFileRef = useRef(null);
  const [newTaskStatus, setNewTaskStatus] = useState("todo");
  const [newTaskForm, setNewTaskForm] = useState({ title:"", description:"", priority:"medium", assigneeId:"", assigneeTeamId:"", startDate:"", dueDate:"", category:"simple" });
  const [newTaskSubtasks, setNewTaskSubtasks] = useState([]); // { title, targetAt }
  const [newTaskSubInput, setNewTaskSubInput] = useState("");
  const [newTaskSubTargetAt, setNewTaskSubTargetAt] = useState("");
  // Card quick-action popover
  const [cardPopover, setCardPopover] = useState(null); // { taskId, type, x, y }
  const [popoverComment, setPopoverComment] = useState("");
  const [newTaskFiles, setNewTaskFiles] = useState([]);
  const [newTaskLinks, setNewTaskLinks] = useState([]); // { label, url }
  const [newTaskLinkLabel, setNewTaskLinkLabel] = useState("");
  const [newTaskLinkUrl, setNewTaskLinkUrl] = useState("");
  // Subtask target date/time
  const [newSubtaskTarget, setNewSubtaskTarget] = useState("");
  // Date-time picker widget state for subtask completion
  const [completionPicker, setCompletionPicker] = useState(null); // { subtaskId, value }
  // Subtask editing modal
  const [editingSubtask, setEditingSubtask] = useState(null);
  const [taskLinks, setTaskLinks] = useState([]);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [showAddLink, setShowAddLink] = useState(false); // { id, title, target_at }
  // Column resize widths
  const [colWidths, setColWidths] = useState({ todo:270, inprogress:270, review:270, done:270 });
  const isResizingCol = useRef(null); // { colId, startX, startW }
  // Pending invites (for the current user)
  const [pendingInvites, setPendingInvites] = useState([]);
  const [showInvites, setShowInvites] = useState(false);
  // Rename project
  const [showRenameProject, setShowRenameProject] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  // Generate report
  const [showReport, setShowReport] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  // Profile modal
  const [showProfile, setShowProfile] = useState(false);
  const [profileTab, setProfileTab] = useState("avatar"); // avatar | password | deactivate
  const [profileCurrentPw, setProfileCurrentPw] = useState("");
  const [profileNewPw, setProfileNewPw] = useState("");
  const [profileMsg, setProfileMsg] = useState({ type:"", text:"" });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const profileFileRef = useRef(null);
  // Status-change confirmation
  const [pendingStatusChange, setPendingStatusChange] = useState(null); // { taskId, status, title }
  // Chat floating widget
  const [chatMinimized, setChatMinimized] = useState(false);
  // Theming: the system-wide palette (set by a super admin, or null/defaults
  // if never customized) and this user's own preference ('default' follows
  // the system palette; otherwise a fixed preset).
  const [systemTheme, setSystemTheme] = useState(null);
  const [myTheme, setMyTheme] = useState(user.theme || "default");
  // Super admin panel
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  // Calendar: click-to-create
  const [calendarNewDate, setCalendarNewDate] = useState(null);
  const newTaskFileRef = useRef(null);

  const dragTaskId = useRef(null);
  const dragOverInfo = useRef(null);
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const cardFileInputRef = useRef(null);
  const isResizingSidebar = useRef(false);

  // Real-time connection: join the active project's room (+ this user's
  // personal room) and react to task/comment/notification events.
  useEffect(() => {
    const socket = io(API_ORIGIN, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      socket.emit("join-user", user.id);
      if (activeProject) socket.emit("join-project", activeProject.id);
    });
    socket.on("reconnect", () => {
      // Re-join rooms and refresh stale data after reconnect
      socket.emit("join-user", user.id);
      if (activeProject) socket.emit("join-project", activeProject.id);
      refreshTasks().catch(() => {});
      api.listPendingInvites(token).then(setPendingInvites).catch(() => {});
    });

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
    socket.on("tasks:reordered", ({ status, orderedIds }) => {
      setTasks((prev) => {
        const others = prev.filter((t) => !orderedIds.includes(t.id));
        const reordered = orderedIds
          .map((id, i) => {
            const t = prev.find((x) => x.id === id);
            return t ? { ...t, status, position: i } : null;
          })
          .filter(Boolean);
        return [...others, ...reordered];
      });
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
    socket.on("subtask:created", (s) => {
      // Update panel subtask list if this task is currently open in the side panel
      setSubtasks((prev) => {
        const isCorrectTask = prev.length === 0 ? false : prev.some((x) => x.task_id === s.task_id);
        // We also update if selectedTask matches — but we can't read selectedTask here safely,
        // so we rely on the dedup guard and let addSubtask handle the optimistic update.
        if (!isCorrectTask && prev.length > 0) return prev; // panel shows different task
        return prev.some((x) => x.id === s.id) ? prev : [...prev, s];
      });
      // Always update bundled subtasks on the task card
      setTasks((prev) => prev.map((t) =>
        t.id === s.task_id
          ? { ...t, subtasks: (t.subtasks || []).some((x) => x.id === s.id) ? t.subtasks : [...(t.subtasks || []), s] }
          : t
      ));
    });
    socket.on("subtask:updated", (s) => {
      setSubtasks((prev) => prev.map((x) => (x.id === s.id ? s : x)));
      setTasks((prev) => prev.map((t) =>
        t.id === s.task_id ? { ...t, subtasks: (t.subtasks || []).map((x) => x.id === s.id ? s : x) } : t
      ));
    });
    socket.on("subtask:deleted", ({ id, task_id }) => {
      setSubtasks((prev) => prev.filter((x) => x.id !== id));
      setTasks((prev) => prev.map((t) =>
        t.id === task_id ? { ...t, subtasks: (t.subtasks || []).filter((x) => x.id !== id) } : t
      ));
    });
    socket.on("notification:new", (n) => {
      setNotifications((prev) => [n, ...prev].slice(0, 50));
      setUnreadCount((c) => c + 1);
      // Refresh badge counts
      if (n.task_id) {
        setTaskUnreadCounts((prev) => ({ ...prev, [n.task_id]: (prev[n.task_id] || 0) + 1 }));
      }
    });
    socket.on("message:created", (msg) => {
      setChatMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    });
    // Invite received in real-time — show the badge and update the list immediately
    socket.on("invite:received", (invite) => {
      setPendingInvites((prev) => prev.some((i) => i.id === invite.id) ? prev : [
        {
          id: invite.id,
          project_id: invite.project_id,
          role: invite.role,
          project_name: "(loading…)",
          invited_by_name: null,
          created_at: invite.created_at,
        },
        ...prev,
      ]);
      // Fetch full details in background
      api.listPendingInvites(token).then(setPendingInvites).catch(() => {});
    });

    return () => socket.disconnect();
  }, [user.id]);

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

  // Load the system-wide theme palette (set by a super admin, if any) once on mount
  useEffect(() => {
    api.getSystemTheme().then(setSystemTheme).catch(() => {});
  }, []);

  // Load the notification inbox + counts once on mount
  useEffect(() => {
    (async () => {
      try {
        const [list, unread, counts] = await Promise.all([
          api.listNotifications(token),
          api.unreadNotificationCount(token),
          api.notificationCounts(token),
        ]);
        setNotifications(list);
        setUnreadCount(unread.count);
        setTaskUnreadCounts(counts.byTask || {});
        setProjectUnreadCounts(counts.byProject || {});
      } catch (err) {
        // non-fatal
      }
    })();
  }, [token]);

  const refreshNotifCounts = async () => {
    try {
      const counts = await api.notificationCounts(token);
      setTaskUnreadCounts(counts.byTask || {});
      setProjectUnreadCounts(counts.byProject || {});
    } catch (_) {}
  };

  // Polling fallback — refresh notification counts and pending invites every 30s
  // in case socket events are missed (network blips, server restarts, etc.)
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const [counts, invites] = await Promise.all([
          api.notificationCounts(token),
          api.listPendingInvites(token),
        ]);
        setTaskUnreadCounts(counts.byTask || {});
        setProjectUnreadCounts(counts.byProject || {});
        setPendingInvites(invites);
      } catch (_) {}
    }, 30000);
    return () => clearInterval(poll);
  }, [token]);
  useEffect(() => {
    api.listPendingInvites(token).then(setPendingInvites).catch(() => {});
  }, [token]);

  const refreshPendingInvites = async () => {
    try { setPendingInvites(await api.listPendingInvites(token)); } catch (_) {}
  };

  const acceptInvite = async (inviteId) => {
    try {
      await api.acceptInvite(token, inviteId);
      setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
      const projs = await api.listProjects(token);
      setProjects(projs);
    } catch (err) { setError(err.message); }
  };

  const declineInvite = async (inviteId) => {
    try {
      await api.declineInvite(token, inviteId);
      setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err) { setError(err.message); }
  };

  // Member invite autocomplete now lives inside MembersPanel.jsx directly.

  // Rename project
  const submitRenameProject = async () => {
    if (!renameValue.trim() || !activeProject) return;
    try {
      const updated = await api.renameProject(token, activeProject.id, renameValue.trim());
      setProjects((prev) => prev.map((p) => (p.id === activeProject.id ? { ...p, ...updated } : p)));
      setActiveProject((prev) => ({ ...prev, ...updated }));
      setShowRenameProject(false);
    } catch (err) { setError(err.message); }
  };

  // Generate report
  const openReport = async () => {
    if (!activeProject) return;
    setShowReport(true);
    setReportLoading(true);
    try {
      const data = await api.getProjectReport(token, activeProject.id);
      setReportData(data);
    } catch (err) { setError(err.message); }
    finally { setReportLoading(false); }
  };

  const exportCurrentViewAsPDF = () => {
    // Use the same "print only this element" technique that already works
    // correctly for the Report modal: visibility (not display) preserves
    // every flex/grid layout inside the target, so content renders exactly
    // as it looks on screen instead of collapsing into a blank page.
    const printStyle = document.createElement("style");
    printStyle.id = "pm-pdf-style";
    printStyle.textContent = `
      @media print {
        body * { visibility: hidden; }
        #pm-pdf-target, #pm-pdf-target * { visibility: visible; }
        #pm-pdf-target {
          position: absolute; left: 0; top: 0; width: 100%;
          height: auto !important; max-height: none !important; overflow: visible !important;
        }
        /* Let every scrollable region print its FULL content instead of
           clipping to whatever fit on screen at the time of export */
        #pm-pdf-target .pm-board,
        #pm-pdf-target .pm-cards,
        #pm-pdf-target .pm-col,
        #pm-pdf-target .cal-wrap,
        #pm-pdf-target .pm-tlwrap,
        #pm-pdf-target .pm-table-wrap {
          height: auto !important; max-height: none !important; overflow: visible !important;
        }
        #pm-pdf-target .pm-board { flex-wrap: wrap !important; }
        /* Hide anything interactive-only that shouldn't appear in a printed page */
        #pm-pdf-target button,
        #pm-pdf-target .pm-card-actions,
        #pm-pdf-target .pm-proj-del,
        #pm-pdf-target .pm-delete-btn,
        #pm-pdf-target .pm-search,
        #pm-pdf-target .chat-float-wrap { display: none !important; }
        @page { margin: 12mm; size: A4 landscape; }
      }
    `;
    document.head.appendChild(printStyle);
    const main = document.querySelector(".pm-main");
    if (main) main.id = "pm-pdf-target";
    window.print();
    setTimeout(() => {
      if (document.getElementById("pm-pdf-style")) document.head.removeChild(printStyle);
      if (main) main.removeAttribute("id");
    }, 1000);
  };

  // Status-change confirmation
  const requestStatusChange = (taskId, newStatus, taskTitle) => {
    setPendingStatusChange({ taskId, status: newStatus, title: taskTitle });
  };
  const confirmStatusChange = () => {
    if (!pendingStatusChange) return;
    moveTaskDirect(pendingStatusChange.taskId, pendingStatusChange.status);
    setPendingStatusChange(null);
  };

  // Load archived projects when the drawer is opened
  useEffect(() => {
    if (!showArchived) return;
    api.listArchivedProjects(token).then(setArchivedProjects).catch(() => {});
  }, [showArchived, token]);

  // Debounced search — triggers 300ms after the user stops typing
  useEffect(() => {
    if (!activeProject) return;
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    const t = setTimeout(async () => {
      try {
        const results = await api.searchTasks(token, activeProject.id, searchQuery);
        setSearchResults(results);
      } catch (err) { setError(err.message); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, activeProject, token]);

  const markNotificationRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await api.markNotificationRead(token, id);
    } catch (err) {
      setError(err.message);
    }
  };

  const markAllNotificationsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    setTaskUnreadCounts({});
    setProjectUnreadCounts({});
    try { await api.markAllNotificationsRead(token); } catch (err) { setError(err.message); }
  };

  const dismissNotification = async (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const dismissed = notifications.find((n) => n.id === id);
    if (dismissed && !dismissed.is_read) {
      setUnreadCount((c) => Math.max(0, c - 1));
      if (dismissed.task_id) setTaskUnreadCounts((prev) => { const n = { ...prev }; n[dismissed.task_id] = Math.max(0, (n[dismissed.task_id] || 1) - 1); if (!n[dismissed.task_id]) delete n[dismissed.task_id]; return n; });
    }
    try { await api.dismissNotification(token, id); } catch (err) { setError(err.message); }
  };

  const clearAllNotifications = async () => {
    setNotifications([]);
    setUnreadCount(0);
    setTaskUnreadCounts({});
    setProjectUnreadCounts({});
    try { await api.clearAllNotifications(token); } catch (err) { setError(err.message); }
  };

  // Load tasks + members + teams whenever the active project changes
  useEffect(() => {
    if (!activeProject) return;
    (async () => {
      try {
        const [taskList, memberList, teamList] = await Promise.all([
          api.listTasks(token, activeProject.id),
          api.listMembers(token, activeProject.id),
          api.listTeams(token, activeProject.id),
        ]);
        setTasks(taskList);
        setMembers(memberList);
        setTeams(teamList);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [activeProject, token]);

  const refreshTeams = async () => {
    if (!activeProject) return;
    const teamList = await api.listTeams(token, activeProject.id);
    setTeams(teamList);
  };

  const refreshMembers = async () => {
    if (!activeProject) return;
    const memberList = await api.listMembers(token, activeProject.id);
    setMembers(memberList);
  };

  // Load comments + attachments + history + subtasks when a task is opened
  useEffect(() => {
    if (!selectedTask) {
      setComments([]);
      setAttachments([]);
      setHistory([]);
      setSubtasks([]);
      setTaskLinks([]);
      setShowAddLink(false);
      setEditTitle(null);
      setEditDesc(null);
      return;
    }
    setEditTitle(selectedTask.title);
    setEditDesc(selectedTask.description || "");
    setShowAllActivity(false);
    // Clear unread badge for this task
    if (taskUnreadCounts[selectedTask.id]) {
      setTaskUnreadCounts((prev) => { const n = { ...prev }; delete n[selectedTask.id]; return n; });
    }
    (async () => {
      try {
        const [c, a, h, s, l] = await Promise.all([
          api.listComments(token, selectedTask.id),
          api.listAttachments(token, selectedTask.id),
          api.taskHistory(token, selectedTask.id),
          api.listSubtasks(token, selectedTask.id),
          api.listLinks(token, selectedTask.id),
        ]);
        setComments(c);
        setAttachments(a);
        setHistory(h);
        setSubtasks(s);
        setTaskLinks(l);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [selectedTask?.id, token]);

  const refreshTasks = async () => {
    if (!activeProject) return;
    try {
      const taskList = await api.listTasks(token, activeProject.id);
      setTasks(taskList);
    } catch (err) {
      console.warn("refreshTasks failed (non-fatal):", err.message);
    }
  };

  const moveTask = async (id, status) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    if (task.status === status) return; // same column reorder — no confirm needed
    requestStatusChange(id, status, task.title);
  };

  const moveTaskDirect = async (id, status) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    try { await api.updateTask(token, id, { status }); }
    catch (err) { setError(err.message); refreshTasks(); }
  };

  const reorderTasks = async (status, orderedIds) => {
    setTasks((prev) => {
      const others = prev.filter((t) => !orderedIds.includes(t.id));
      const reordered = orderedIds.map((id, i) => {
        const t = prev.find((x) => x.id === id);
        return { ...t, status, position: i };
      });
      return [...others, ...reordered];
    });
    try {
      await api.reorderTasks(token, activeProject.id, status, orderedIds);
    } catch (err) {
      setError(err.message);
      refreshTasks();
    }
  };

  // Dropping directly on a card reorders within that column (or moves +
  // inserts at a precise spot if dragged from another column).
  const handleCardDrop = (e, columnId, targetTask) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = dragTaskId.current;
    if (!draggedId || draggedId === targetTask.id) return;

    const colTasks = tasks.filter((t) => t.status === columnId);
    const ids = colTasks.map((t) => t.id).filter((id) => id !== draggedId);
    const targetIndex = ids.indexOf(targetTask.id);

    const rect = e.currentTarget.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    const insertAt = before ? targetIndex : targetIndex + 1;
    ids.splice(insertAt, 0, draggedId);

    reorderTasks(columnId, ids);
    setDragOverCol(null);
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

      // The PATCH response has raw IDs but no display fields (name/initials/color).
      // Enrich with local member/team data so all views reflect the change instantly
      // without needing a full task list refresh.
      let enriched = { ...updated };
      if ("assigneeId" in patch || "assigneeTeamId" in patch) {
        if (updated.assignee_id) {
          const m = members.find((x) => x.id === updated.assignee_id);
          if (m) enriched = { ...enriched, assignee_name: m.name, assignee_initials: m.initials, assignee_color: m.color, assignee_team_id: null, team_name: null, team_color: null };
        } else if (updated.assignee_team_id) {
          const tm = teams.find((x) => x.id === updated.assignee_team_id);
          if (tm) enriched = { ...enriched, assignee_id: null, assignee_name: null, assignee_initials: null, assignee_color: null, team_name: tm.name, team_color: tm.color };
        } else {
          enriched = { ...enriched, assignee_id: null, assignee_name: null, assignee_initials: null, assignee_color: null, assignee_team_id: null, team_name: null, team_color: null };
        }
      }

      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...enriched } : t)));
      setSelectedTask((cur) => (cur && cur.id === id ? { ...cur, ...enriched } : cur));
    } catch (err) {
      setError(err.message);
      refreshTasks();
    }
  };

  // Save title/description explicitly (not per-keystroke)
  const saveTaskText = async (id) => {
    const patch = {};
    if (editTitle !== null && editTitle !== selectedTask.title) patch.title = editTitle;
    if (editDesc !== null && editDesc !== selectedTask.description) patch.description = editDesc;
    if (Object.keys(patch).length === 0) return;
    try {
      const updated = await api.updateTask(token, id, patch);
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
      setSelectedTask((cur) => (cur && cur.id === id ? { ...cur, ...updated } : cur));
      // Refresh history so the new entries appear
      const h = await api.taskHistory(token, id);
      setHistory(h);
    } catch (err) {
      setError(err.message);
    }
  };

  const addSubtask = async () => {
    if (!newSubtask.trim() || !selectedTask) return;
    try {
      const s = await api.createSubtask(token, selectedTask.id, newSubtask.trim(), fromLocalInputValue(newSubtaskTarget));
      setNewSubtask("");
      setNewSubtaskTarget("");
      // Update the panel subtask list directly (don't rely on refreshTasks which
      // would re-fetch and cause a duplicate alongside the socket event).
      setSubtasks((prev) => prev.some((x) => x.id === s.id) ? prev : [...prev, s]);
      // Also update the bundled subtasks on the task card for cross-view plotting
      // without doing a full refreshTasks() which is what caused the duplication.
      setTasks((prev) => prev.map((t) =>
        t.id === s.task_id
          ? { ...t, subtasks: (t.subtasks || []).some((x) => x.id === s.id) ? t.subtasks : [...(t.subtasks || []), s] }
          : t
      ));
    } catch (err) { setError(err.message); }
  };

  const toggleSubtask = async (id, is_done) => {
    if (is_done) {
      // Show the date-time picker widget instead of window.prompt
      const defaultDt = toLocalInputValue(new Date());
      setCompletionPicker({ subtaskId: id, value: defaultDt });
    } else {
      setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, is_done: false } : s)));
      try {
        const updated = await api.updateSubtask(token, id, { is_done: false });
        const h = await api.taskHistory(token, selectedTask?.id);
        if (h) setHistory(h);
        setTasks((prev) => prev.map((t) =>
          t.id === updated.task_id
            ? { ...t, subtasks: (t.subtasks || []).map((s) => s.id === id ? updated : s) }
            : t
        ));
      } catch (err) { setError(err.message); setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, is_done: true } : s))); }
    }
  };

  const confirmSubtaskCompletion = async () => {
    if (!completionPicker) return;
    const { subtaskId, value } = completionPicker;
    setCompletionPicker(null);
    const completedAt = value ? fromLocalInputValue(value) : new Date().toISOString();
    setSubtasks((prev) => prev.map((s) => (s.id === subtaskId ? { ...s, is_done: true, target_at: completedAt } : s)));
    try {
      const updated = await api.updateSubtask(token, subtaskId, { is_done: true, targetAt: completedAt });
      const h = await api.taskHistory(token, selectedTask?.id);
      if (h) setHistory(h);
      setTasks((prev) => prev.map((t) =>
        t.id === updated.task_id
          ? { ...t, subtasks: (t.subtasks || []).map((s) => s.id === subtaskId ? updated : s) }
          : t
      ));
    } catch (err) { setError(err.message); setSubtasks((prev) => prev.map((s) => (s.id === subtaskId ? { ...s, is_done: false } : s))); }
  };

  const deleteSubtask = async (id) => {
    const sub = subtasks.find((s) => s.id === id);
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
    if (sub) {
      setTasks((prev) => prev.map((t) =>
        t.id === sub.task_id ? { ...t, subtasks: (t.subtasks || []).filter((s) => s.id !== id) } : t
      ));
    }
    try { await api.deleteSubtask(token, id); }
    catch (err) { setError(err.message); refreshTasks(); }
  };

  const dragSubtaskRef = useRef(null);

  const handleSubtaskDragStart = (id) => { dragSubtaskRef.current = id; };
  const handleSubtaskDrop = async (targetId) => {
    if (!dragSubtaskRef.current || dragSubtaskRef.current === targetId) return;
    const draggedId = dragSubtaskRef.current;
    dragSubtaskRef.current = null;
    setSubtasks((prev) => {
      const from = prev.findIndex((s) => s.id === draggedId);
      const to   = prev.findIndex((s) => s.id === targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      next.forEach((s, i) => {
        if (s.position !== i) api.updateSubtask(token, s.id, { position: i }).catch(() => {});
      });
      return next.map((s, i) => ({ ...s, position: i }));
    });
  };

  const saveSubtaskEdit = async () => {
    if (!editingSubtask) return;
    const { id, title, target_at } = editingSubtask;
    setEditingSubtask(null);
    try {
      const updated = await api.updateSubtask(token, id, { title, targetAt: target_at ? fromLocalInputValue(target_at) : undefined });
      setSubtasks((prev) => prev.map((s) => s.id === id ? updated : s));
      setTasks((prev) => prev.map((t) =>
        t.subtasks ? { ...t, subtasks: t.subtasks.map((s) => s.id === id ? updated : s) } : t
      ));
    } catch (err) { setError(err.message); }
  };

  const startColResize = (e, colId) => {
    e.preventDefault();
    isResizingCol.current = { colId, startX: e.clientX, startW: colWidths[colId] };
    const onMove = (ev) => {
      if (!isResizingCol.current) return;
      const { colId: cid, startX, startW } = isResizingCol.current;
      const newW = Math.max(200, Math.min(500, startW + ev.clientX - startX));
      setColWidths((prev) => ({ ...prev, [cid]: newW }));
    };
    const onUp = () => {
      isResizingCol.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const archiveProject = async (id, is_archived) => {
    try {
      await api.archiveProject(token, id, is_archived);
      if (is_archived) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        if (activeProject && activeProject.id === id) setActiveProject(null);
      } else {
        const projs = await api.listProjects(token);
        setProjects(projs);
        setArchivedProjects((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (err) { setError(err.message); }
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

  // Sidebar resize
  const startSidebarResize = (e) => {
    e.preventDefault();
    isResizingSidebar.current = true;
    const onMove = (ev) => {
      if (!isResizingSidebar.current) return;
      setSidebarWidth((w) => Math.max(160, Math.min(420, ev.clientX)));
    };
    const onUp = () => {
      isResizingSidebar.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const submitNewProject = async () => {
    if (!newProjName.trim()) return;
    try {
      const proj = await api.createProject(token, newProjName.trim(), newProjDesc.trim());
      setNewProjName(""); setNewProjDesc("");
      setShowNewProject(false);
      setProjects((prev) => [proj, ...prev]);
      setActiveProject(proj);
    } catch (err) {
      setError(err.message);
    }
  };

  const openNewTask = (status = "todo") => {
    setNewTaskStatus(status);
    setNewTaskForm({ title:"", description:"", priority:"medium", assigneeId:"", assigneeTeamId:"", startDate:"", dueDate:"", category:"simple" });
    setNewTaskSubtasks([]);
    setNewTaskSubInput("");
    setNewTaskFiles([]);
    setNewTaskLinks([]);
    setNewTaskLinkLabel("");
    setNewTaskLinkUrl("");
    setShowNewTask(true);
  };

  const submitNewTask = async () => {
    if (!newTaskForm.title.trim() || !activeProject) return;
    try {
      const payload = {
        projectId: activeProject.id,
        title: newTaskForm.title.trim(),
        description: newTaskForm.description,
        priority: newTaskForm.priority,
        category: newTaskForm.category,
        assigneeId: newTaskForm.assigneeId ? Number(newTaskForm.assigneeId) : undefined,
        assigneeTeamId: newTaskForm.assigneeTeamId ? Number(newTaskForm.assigneeTeamId) : undefined,
        startDate: newTaskForm.startDate || undefined,
        dueDate: newTaskForm.dueDate || undefined,
      };
      const created = await api.createTask(token, payload);
      // Upload any subtasks added in the modal
      for (const sub of newTaskSubtasks) {
        try { await api.createSubtask(token, created.id, sub.title, sub.targetAt || undefined); }
        catch (e) { console.error("Subtask creation failed:", e.message); }
      }
      // Upload any files that were attached in the modal
      for (const file of newTaskFiles) {
        try { await api.uploadAttachment(token, created.id, file); }
        catch (e) { console.error("File upload failed:", e.message); }
      }
      // Create any links that were staged in the modal
      for (const link of newTaskLinks) {
        try { await api.addLink(token, created.id, link.label, link.url); }
        catch (e) { console.error("Link creation failed:", e.message); }
      }
      setNewTaskFiles([]);
      setNewTaskSubtasks([]);
      setNewTaskLinks([]);
      setShowNewTask(false);
      refreshTasks();
    } catch (err) {
      setError(err.message);
    }
  };

  // -- Task import (CSV) --
  const openImportTasks = () => {
    setImportRows([]);
    setImportFileName("");
    setImportError("");
    setImportResult(null);
    setShowImportTasks(true);
  };

  const handleImportFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError("");
    setImportResult(null);
    setImportFileName(file.name);
    try {
      const text = await file.text();
      const rows = csvToTaskRows(text);
      if (rows.length === 0) {
        setImportRows([]);
        setImportError("No task rows found in that file — check it still has the header row plus at least one task below it.");
        return;
      }
      if (rows.length > 500) {
        setImportRows([]);
        setImportError(`That file has ${rows.length} rows — imports are limited to 500 at a time. Split it into smaller batches.`);
        return;
      }
      setImportRows(rows);
    } catch (err) {
      setImportRows([]);
      setImportError("Couldn't read that file. Make sure it's a .csv exported or saved from Excel/Sheets.");
    }
  };

  const submitImportTasks = async () => {
    if (!activeProject || importRows.length === 0) return;
    setImporting(true);
    setImportError("");
    try {
      const result = await api.importTasks(token, activeProject.id, importRows);
      setImportResult(result);
      if (result.createdCount > 0) refreshTasks();
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  // Card quick-action popover helpers
  const openCardPopover = (e, taskId, type) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setCardPopover({ taskId, type, x: rect.left, y: rect.bottom + 6 });
    setPopoverComment("");
  };

  const closeCardPopover = () => setCardPopover(null);

  const cardPopoverPatch = async (taskId, patch) => {
    try {
      await patchTask(taskId, patch);
    } catch (err) { setError(err.message); }
    closeCardPopover();
  };

  const submitCardComment = async () => {
    if (!popoverComment.trim() || !cardPopover) return;
    try {
      await api.addComment(token, cardPopover.taskId, popoverComment.trim());
      setPopoverComment("");
      closeCardPopover();
      refreshTasks();
    } catch (err) { setError(err.message); }
  };

  const createProject = async () => { /* replaced by submitNewProject */ };

  const removeProject = async (e, project) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      `Delete "${project.name}"? This permanently deletes all of its tasks, comments, and teams. This can't be undone.`
    );
    if (!confirmed) return;
    try {
      await api.deleteProject(token, project.id);
      setProjects((prev) => {
        const remaining = prev.filter((p) => p.id !== project.id);
        if (activeProject && activeProject.id === project.id) {
          setActiveProject(remaining[0] || null);
        }
        return remaining;
      });
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif" }}>Loading workspace…</div>;
  }

  const activityFeed = [
    ...history.map((h) => ({ kind: "history", ...h })),
    ...comments.map((c) => ({ kind: "comment", ...c })),
  ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const ACTIVITY_PREVIEW = 5;
  const visibleActivity = showAllActivity ? activityFeed : activityFeed.slice(-ACTIVITY_PREVIEW);

  // Viewers get a read-only experience: no status changes, no subtasks, no
  // comments/attachments/links, no chat, no drag-and-drop, no task creation.
  const isViewer = activeProject?.my_role === "viewer";

  const themeVars = getThemeVars(myTheme, systemTheme);

  return (
    <div className="pm-root" style={themeVars} onClick={() => { setShowInvites(false); }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:wght@700&display=swap');

        * { box-sizing: border-box; }
        .pm-root {
          --ink: #0B2233;
          --paper: #EEF6FC;
          --paper-deep: #DCF0FB;
          --card: #FFFFFF;
          --muted: #6B92AD;
          --border: #C5DFF0;
          --teal: #1A7FA8;
          --teal-deep: #0B4F6C;
          --gold: #1A7FA8;
          --sidebar-bg: linear-gradient(180deg,#0B4F6C 0%,#1A7FA8 100%);
          font-family: 'Inter', sans-serif; color: var(--ink); background: var(--paper);
          height: 100vh; display: flex; overflow: hidden;
        }
        .pm-serif { font-family: 'Merriweather', serif; }
        .pm-mono { font-family: 'JetBrains Mono', monospace; }
        .pm-sidebar { width: var(--sidebar-w, 240px); flex-shrink: 0; background: var(--sidebar-bg, linear-gradient(180deg,#0B4F6C 0%,#1A7FA8 100%)); color: #E8F4FC; display: flex; flex-direction: column; transition: width 0.05s; overflow: hidden; position: relative; }
        .pm-sidebar.collapsed { width: 0 !important; }
        .pm-sidebar-resize { position:absolute; top:0; right:0; width:5px; height:100%; cursor:col-resize; z-index:10; background:transparent; }
        .pm-sidebar-resize:hover { background:rgba(255,255,255,0.18); }
        .pm-sidebar-toggle { position:fixed; left:var(--sidebar-w,240px); top:50%; transform:translateY(-50%) translateX(-50%); z-index:20; width:22px; height:44px; background:#1A7FA8; border:2px solid #fff; border-radius:999px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#fff; font-size:12px; box-shadow:0 2px 8px rgba(0,0,0,0.18); transition:left 0.05s; }
        .pm-sidebar-toggle.collapsed { left:0; transform:translateY(-50%) translateX(50%); }
        .pm-sidebar-brand { padding: 16px 16px 14px; border-bottom: 1px solid rgba(255,255,255,0.12); display:flex; flex-direction:row; align-items:center; gap:10px; }
        .pm-sidebar-section { padding: 14px 20px 5px; font-size: 11px; letter-spacing: 0.09em; text-transform: uppercase; color: rgba(255,255,255,0.5); }
        .pm-proj-item { margin: 2px 10px; padding: 9px 12px; border-radius: 8px; font-size: 13.5px; display: flex; align-items: center; gap: 9px; cursor: pointer; color: rgba(255,255,255,0.82); }
        .pm-proj-item.active { background: rgba(255,255,255,0.18); color: #fff; }
        .pm-proj-item:hover:not(.active) { background: rgba(255,255,255,0.09); }
        .pm-proj-del { flex-shrink: 0; opacity: 0; color: rgba(255,255,255,0.5); cursor: pointer; }
        .pm-proj-item:hover .pm-proj-del { opacity: 1; }
        .pm-proj-del:hover { color: #FCA5A5; }
        .pm-proj-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink:0; }
        .pm-proj-add { display:flex; gap:6px; margin: 8px 12px; }
        .pm-proj-add input { flex:1; min-width:0; background: rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:6px; padding:6px 8px; font-size:12px; outline:none; }
        .pm-proj-add input::placeholder { color:rgba(255,255,255,0.45); }
        .pm-proj-add button { background: rgba(255,255,255,0.22); border:none; border-radius:6px; padding: 0 11px; cursor:pointer; font-weight:700; color:#fff; font-size:16px; }
        .pm-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .pm-topbar { padding: 18px 28px 0; background: var(--paper); }
        .pm-topbar-row1 { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .pm-title { font-size: 21px; font-weight: 700; color: var(--teal-deep); }
        .pm-title .ruleline { display: block; width: 46px; height: 3px; background: var(--teal); margin-top: 6px; border-radius: 2px; }
        .pm-search { display: flex; align-items: center; gap: 8px; background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 7px 12px; width: 200px; color: var(--muted); font-size: 13px; }
        .pm-search input { border: none; outline: none; background: transparent; width: 100%; font-size: 13px; }
        .pm-avatars { display: flex; }
        .pm-avatar { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 11.5px; font-weight: 600; border: 2px solid var(--paper); margin-left: -8px; }
        .pm-btn-primary { display: flex; align-items: center; gap: 6px; background: var(--teal); color: white; border: none; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .pm-btn-primary:hover { background: var(--teal-deep); }
        .pm-btn-ghost { display:flex; align-items:center; gap:6px; background:transparent; border:1px solid var(--border); color: var(--teal-deep); padding: 8px 12px; border-radius: 8px; font-size: 12.5px; cursor:pointer; }
        .pm-btn-ghost:hover { background: var(--paper-deep); }
        .pm-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--border); }
        .pm-tab { display: flex; align-items: center; gap: 6px; padding: 9px 14px; font-size: 13px; color: var(--muted); border-bottom: 2px solid transparent; cursor: pointer; }
        .pm-tab.active { color: var(--teal-deep); border-bottom: 2px solid var(--teal); font-weight: 600; }
        .pm-board { flex: 1; display: flex; gap: 16px; padding: 18px 28px 22px; overflow-x: auto; }
        .pm-col { flex-shrink: 0; display: flex; flex-direction: column; background: var(--paper-deep); border-radius: 12px; padding: 10px; max-height: 100%; position: relative; }
        .pm-col.dragover { outline: 2px dashed var(--teal); outline-offset: -4px; }
        .pm-col-resize { position:absolute; top:0; right:0; width:5px; height:100%; cursor:col-resize; z-index:5; background:transparent; border-radius:0 12px 12px 0; }
        .pm-col-resize:hover { background:rgba(26,127,168,0.18); }
        .pm-completion-overlay { position:fixed; inset:0; background:rgba(11,79,108,0.22); z-index:300; display:flex; align-items:center; justify-content:center; }
        .pm-completion-widget { background:#fff; border-radius:14px; padding:24px 26px; width:320px; box-shadow:0 12px 40px rgba(11,79,108,0.22); }
        .pm-completion-title { font-size:15px; font-weight:700; color:var(--teal-deep); margin-bottom:4px; }
        .pm-completion-sub { font-size:12.5px; color:var(--muted); margin-bottom:16px; }
        .pm-subtask-meta { font-size:10.5px; color:var(--muted); margin-top:2px; display:flex; align-items:center; gap:4px; }
        .pm-subtask-meta.completed { color:#7C3AED; }
        .pm-col-head { display: flex; align-items: center; justify-content: space-between; padding: 6px 6px 10px; }
        .pm-col-head-left { display: flex; align-items: baseline; gap: 7px; }
        .pm-col-no { font-size: 10.5px; color: var(--muted); }
        .pm-col-label { font-size: 13.5px; font-weight: 700; }
        .pm-col-count { font-size: 11px; color: var(--muted); background: var(--card); border-radius: 999px; padding: 1px 7px; }
        .pm-col-bar { height: 3px; border-radius: 2px; margin: 0 6px 10px; }
        .pm-cards { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 9px; padding: 0 2px 4px; }
        .pm-card { background: var(--card); border-radius: 10px; padding: 11px 12px 10px; box-shadow: 0 1px 3px rgba(11,79,108,0.08); border: 1px solid var(--border); cursor: grab; position: relative; }
        .pm-card:hover { border-color: #8BBFD9; box-shadow: 0 2px 8px rgba(11,79,108,0.12); }
        .pm-flag { position: absolute; top: 0; right: 12px; width: 10px; height: 16px; clip-path: polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%); }
        .pm-card-del { position: absolute; top: 8px; right: 28px; opacity: 0; color: var(--muted); cursor: pointer; }
        .pm-card:hover .pm-card-del { opacity: 1; }
        .pm-card-del:hover { color: #9C4221; }
        .pm-card-title { font-size: 13.5px; font-weight: 600; line-height: 1.35; margin-bottom: 8px; padding-right: 14px; }
        .pm-labels { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 9px; }
        .pm-label-chip { font-size: 10px; padding: 2px 7px; border-radius: 5px; background: #DAEEF9; color: #0B4F6C; font-weight: 600; }
        .pm-card-foot { display: flex; align-items: center; justify-content: space-between; }
        .pm-card-meta { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 11px; }
        .pm-card-meta-item { display: flex; align-items: center; gap: 3px; }
        .pm-card-avatar { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 9.5px; font-weight: 700; }
        .pm-card-team { display:flex; align-items:center; gap:4px; padding: 3px 8px; border-radius: 999px; color:#fff; font-size: 10px; font-weight: 700; max-width: 130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .pm-quickadd { padding: 4px 2px 2px; }
        .pm-quickadd input { width: 100%; box-sizing:border-box; border: 1px dashed var(--border); background: transparent; border-radius: 8px; padding: 8px 10px; font-size: 12.5px; outline: none; }
        .pm-quickadd input:focus { border-color: var(--teal); background: var(--card); }
        .pm-overlay { position: fixed; inset: 0; background: rgba(27,27,31,0.32); display: flex; justify-content: flex-end; z-index: 50; }
        .pm-panel { width: 420px; max-width: 92vw; height: 100%; background: var(--card); padding: 22px 24px; overflow-y: auto; box-shadow: -8px 0 24px rgba(0,0,0,0.12); }
        .pm-panel-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
        .pm-panel-close { cursor: pointer; color: var(--muted); }
        .pm-panel-title { width: 100%; box-sizing:border-box; font-size: 18px; font-weight: 700; border: none; outline: none; font-family: 'Fraunces', serif; resize: none; margin-bottom: 14px; }
        .pm-field-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 5px; margin-top: 16px; }
        .pm-select, .pm-textarea, .pm-dateinput { width: 100%; box-sizing:border-box; border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 13px; font-family: 'Inter', sans-serif; outline: none; }
        .pm-textarea { resize: vertical; min-height: 64px; }
        .pm-delete-btn { margin-top: 22px; color: #DC2626; font-size: 12.5px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; }
        .pm-card-actions { display:flex; gap:5px; margin-top:8px; opacity:0; transition:opacity 0.15s; }
        .pm-card:hover .pm-card-actions { opacity:1; }
        .pm-card-action-btn { width:28px; height:28px; border:1.5px solid var(--border); background:#fff; border-radius:7px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--teal); transition:background 0.12s, border-color 0.12s, color 0.12s; flex-shrink:0; }
        .pm-card-action-btn:hover { background:var(--teal); color:#fff; border-color:var(--teal); }
        .pm-card-popover { position:fixed; z-index:200; background:#fff; border:1px solid var(--border); border-radius:10px; box-shadow:0 8px 32px rgba(11,79,108,0.18); min-width:200px; padding:8px; }
        .pm-card-popover.type-comment { width:260px; min-width:260px; }
        .pm-pop-option { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:7px; cursor:pointer; font-size:13px; }
        .pm-pop-option:hover { background:var(--paper-deep); }
        .pm-pop-option.active { font-weight:700; color:var(--teal-deep); }
        .pm-pop-textarea { width:100%; border:1px solid var(--border); border-radius:8px; padding:7px 9px; font-size:12.5px; font-family:'Inter',sans-serif; resize:none; outline:none; margin-bottom:7px; }
        .pm-pop-textarea:focus { border-color:var(--teal); }
        .pm-pop-close { position:absolute; top:6px; right:8px; cursor:pointer; color:var(--muted); font-size:16px; line-height:1; }
        .pm-modal-overlay { position:fixed; inset:0; background:rgba(11,79,108,0.28); z-index:100; display:flex; align-items:center; justify-content:center; padding:16px; }
        .pm-modal { background:#fff; border-radius:16px; width:100%; max-width:460px; max-height:88vh; overflow-y:auto; box-shadow:0 12px 48px rgba(11,79,108,0.22); }
        .pm-modal-head { display:flex; justify-content:space-between; align-items:center; padding:20px 24px 0; }
        .pm-modal-title { font-size:18px; font-weight:700; color:var(--teal-deep); }
        .pm-modal-body { padding:16px 24px 24px; }
        .pm-field-row { margin-bottom:14px; }
        .pm-field-row label { display:block; font-size:11.5px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:5px; }
        .pm-field-row input, .pm-field-row select, .pm-field-row textarea { width:100%; border:1.5px solid var(--border); border-radius:9px; padding:9px 12px; font-size:13.5px; font-family:'Inter',sans-serif; outline:none; background:#fff; transition:border-color 0.15s; }
        .pm-field-row input:focus, .pm-field-row select:focus, .pm-field-row textarea:focus { border-color:var(--teal); }
        .pm-field-row textarea { resize:vertical; min-height:72px; }
        .pm-field-row-2col { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px; }
        .pm-modal-footer { display:flex; gap:10px; justify-content:flex-end; padding-top:6px; }
        .pm-btn-cancel { padding:9px 18px; border-radius:9px; border:1.5px solid var(--border); background:#fff; font-size:13.5px; font-weight:600; cursor:pointer; color:var(--muted); }
        .pm-btn-cancel:hover { background:var(--paper-deep); }
        /* Modern thin scrollbars for all scroll areas */
        .pm-root *, .pm-board, .pm-cards, .pm-panel, .pm-modal, .pm-search-results,
        .pm-thread, .chat-thread, .pm-bell-dropdown {
          scrollbar-width: thin;
          scrollbar-color: rgba(26,127,168,0.3) transparent;
        }
        .pm-root *::-webkit-scrollbar { width: 5px; height: 5px; }
        .pm-root *::-webkit-scrollbar-track { background: transparent; }
        .pm-root *::-webkit-scrollbar-thumb { background: rgba(26,127,168,0.3); border-radius: 99px; }
        .pm-root *::-webkit-scrollbar-thumb:hover { background: rgba(26,127,168,0.55); }
        /* Smooth scroll everywhere */
        .pm-cards, .pm-panel, .pm-modal, .pm-search-results, .pm-board { scroll-behavior: smooth; }
        /* Kanban board horizontal scroll with snap */
        .pm-board { scroll-snap-type: x proximity; }
        .pm-col { scroll-snap-align: start; }
        /* Hide scrollbar until hover on cards list */
        .pm-cards { scrollbar-width: none; }
        .pm-cards:hover { scrollbar-width: thin; }
        .pm-cards::-webkit-scrollbar { width: 4px; }
        .pm-cards:hover::-webkit-scrollbar-thumb { background: rgba(26,127,168,0.25); border-radius: 99px; }
        .pm-cards::-webkit-scrollbar-thumb { background: transparent; }
        .pm-task-badge { position:absolute; top:-6px; right:-6px; background:#EF4444; color:#fff; font-size:9px; font-weight:800; border-radius:999px; min-width:15px; height:15px; display:flex; align-items:center; justify-content:center; padding:0 2px; border:1.5px solid var(--card); pointer-events:none; z-index:2; }
        .pm-proj-badge { background:#EF4444; color:#fff; font-size:9px; font-weight:800; border-radius:999px; min-width:15px; height:15px; display:inline-flex; align-items:center; justify-content:center; padding:0 3px; margin-left:auto; flex-shrink:0; }
        .pm-activity-row { display:flex; align-items:flex-start; gap: 7px; padding: 6px 0; }
        .pm-activity-icon { color: var(--teal); margin-top: 3px; flex-shrink: 0; }
        .pm-activity-detail { font-size: 12px; color: #0B4F6C; }
        .pm-activity-time { font-size: 10.5px; color: var(--muted); }
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
        .pm-error-banner { background:#FEE2E2; color:#991B1B; padding:8px 28px; font-size:12.5px; border-bottom: 1px solid #FECACA; }
        .pm-verify-banner { background:#DBEAFE; color:#1E40AF; padding:8px 28px; font-size:12.5px; border-bottom: 1px solid #BFDBFE; }
        .pm-verify-link { font-weight:600; cursor:pointer; text-decoration:underline; }
        .pm-search-results { flex:1; overflow-y:auto; padding: 18px 28px; }
        .pm-search-header { font-size:12px; color:var(--muted); margin-bottom:10px; }
        .pm-search-task-row { display:flex; align-items:center; gap:10px; padding: 9px 12px; background:var(--card); border:1px solid var(--border); border-radius:9px; margin-bottom:7px; cursor:pointer; }
        .pm-search-task-row:hover { border-color: var(--teal); background: #F0F8FF; }
        .pm-search-status { font-size:10px; padding:2px 7px; border-radius:999px; color:#fff; font-weight:700; flex-shrink:0; }
        .pm-subtasks-wrap { margin-top: 14px; }
        .pm-subtask-row { display:flex; align-items:center; gap:8px; padding: 6px 0; border-bottom: 1px solid #F1EDE2; }
        .pm-subtask-row:last-child { border-bottom: none; }
        .pm-subtask-check { cursor:pointer; color:var(--muted); flex-shrink:0; }
        .pm-subtask-check.done { color: var(--teal); }
        .pm-subtask-title { flex:1; font-size:13px; }
        .pm-subtask-title.done { text-decoration:line-through; color:var(--muted); }
        .pm-subtask-del { cursor:pointer; color:var(--muted); opacity:0; transition:opacity 0.15s; }
        .pm-subtask-row:hover .pm-subtask-del { opacity:1; }
        .pm-subtask-row:hover .pm-subtask-edit-btn { opacity:1 !important; }
        .pm-subtask-add { display:flex; gap:7px; margin-top:8px; }
        .pm-subtask-add input { flex:1; border:1px dashed var(--border); border-radius:7px; padding:6px 9px; font-size:12.5px; outline:none; }
        .pm-subtask-add input:focus { border-color:var(--teal); background:var(--card); }
        .pm-save-row { display:flex; justify-content:flex-end; margin-top:5px; }
      `}</style>

      <aside
        className={`pm-sidebar${sidebarCollapsed ? " collapsed" : ""}`}
        style={{ "--sidebar-w": `${sidebarWidth}px`, width: sidebarCollapsed ? 0 : sidebarWidth }}
      >
        <div className="pm-sidebar-brand" style={{ opacity: sidebarCollapsed ? 0 : 1 }}>
          <img
            src="https://i.ibb.co/6R9j9kvg/mwss-logo-seal.png"
            alt="MWSS Logo"
            style={{ width: 46, height: 46, objectFit: "contain", flexShrink: 0 }}
            onError={(e) => { e.target.style.display = "none"; }}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>MWSS RO</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap" }}>Project Workspace</div>
          </div>
        </div>

        {/* Super Admin entry point — only visible to super admins */}
        {user.is_super_admin && (
          <div style={{ padding: "10px 12px 2px" }}>
            <div
              className="pm-proj-item"
              style={{ background: "rgba(255,255,255,0.1)", border: "1px dashed rgba(255,255,255,0.3)" }}
              onClick={() => setShowAdminPanel(true)}
              title="Super Admin — manage all users and system theme"
            >
              <UserCog size={13} /> Super Admin
            </div>
          </div>
        )}

        {/* My Projects */}
        {projects.filter((p) => p.my_role === "owner" || p.my_role === "admin").length > 0 && (
          <div className="pm-sidebar-section" style={{ display:"flex", alignItems:"center", gap:5 }}>
            <span>🗂</span> My Projects
          </div>
        )}
        {projects.filter((p) => p.my_role === "owner" || p.my_role === "admin").map((p) => (
          <div
            key={p.id}
            className={`pm-proj-item ${activeProject && activeProject.id === p.id ? "active" : ""}`}
            onClick={() => setActiveProject(p)}
          >
            <span style={{ fontSize:12, flexShrink:0 }}>{p.my_role === "owner" ? "👑" : "🛡"}</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
            {projectUnreadCounts[p.id] > 0 && (
              <span className="pm-proj-badge">{projectUnreadCounts[p.id] > 9 ? "9+" : projectUnreadCounts[p.id]}</span>
            )}
            <Archive size={12} className="pm-proj-del" title="Archive" onClick={(e) => { e.stopPropagation(); archiveProject(p.id, true); }} />
            {p.my_role === "owner" && (
              <Trash2 size={12} className="pm-proj-del" title="Delete" onClick={(e) => removeProject(e, p)} />
            )}
          </div>
        ))}

        {/* Invited Projects */}
        {projects.filter((p) => p.my_role === "contributor" || p.my_role === "viewer").length > 0 && (
          <div className="pm-sidebar-section" style={{ display:"flex", alignItems:"center", gap:5 }}>
            <span>👥</span> Invited Projects
          </div>
        )}
        {projects.filter((p) => p.my_role === "contributor" || p.my_role === "viewer").map((p) => (
          <div
            key={p.id}
            className={`pm-proj-item ${activeProject && activeProject.id === p.id ? "active" : ""}`}
            onClick={() => setActiveProject(p)}
          >
            <span style={{ fontSize:12, flexShrink:0 }} title={p.my_role === "viewer" ? "Viewer — view only" : "Contributor"}>{p.my_role === "viewer" ? "👁" : "👤"}</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
            {projectUnreadCounts[p.id] > 0 && (
              <span className="pm-proj-badge">{projectUnreadCounts[p.id] > 9 ? "9+" : projectUnreadCounts[p.id]}</span>
            )}
          </div>
        ))}

        {/* New Project button */}
        <div style={{ padding: "8px 12px" }}>
          <button
            onClick={() => { setNewProjName(""); setNewProjDesc(""); setShowNewProject(true); }}
            style={{ width:"100%", background:"rgba(255,255,255,0.14)", border:"1.5px dashed rgba(255,255,255,0.3)", borderRadius:9, padding:"8px 0", color:"#fff", fontSize:12.5, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}
          >
            <Plus size={14} /> New Project
          </button>
        </div>

        {activeProject && (
          <>
            <div className="pm-sidebar-section">Workspace</div>
            <div className="pm-proj-item" onClick={() => setShowMembersPanel(true)}>
              <UserCog size={13} /> Members {members.length > 0 && <span style={{ color: "rgba(255,255,255,0.5)", marginLeft: "auto" }}>{members.length}</span>}
            </div>
            <div className="pm-proj-item" onClick={() => setShowTeamsPanel(true)}>
              <Users size={13} /> Teams {teams.length > 0 && <span style={{ color: "rgba(255,255,255,0.5)", marginLeft: "auto" }}>{teams.length}</span>}
            </div>
            <div className="pm-proj-item" onClick={() => setShowArchived(true)}>
              <Archive size={13} /> Archived
            </div>
            <div className="pm-proj-item" onClick={() => setShowChat(true)} style={{ position: "relative" }}>
              <MessageSquare size={13} /> Chat
              {chatMessages.filter((m) => m.project_id === activeProject?.id && m.author_id !== user.id).length > 0 && (
                <span className="pm-proj-badge" style={{ marginLeft: "auto" }}>
                  {chatMessages.filter((m) => m.project_id === activeProject?.id && m.author_id !== user.id).length > 9 ? "9+" :
                   chatMessages.filter((m) => m.project_id === activeProject?.id && m.author_id !== user.id).length}
                </span>
              )}
            </div>
            {activeProject.my_role !== "owner" && (
              <div
                className="pm-proj-item"
                style={{ color:"rgba(252,165,165,0.9)" }}
                onClick={async () => {
                  if (!window.confirm(`Leave "${activeProject.name}"? You'll lose access and need a new invitation.`)) return;
                  try {
                    await api.leaveProject(token, activeProject.id);
                    setProjects((prev) => prev.filter((p) => p.id !== activeProject.id));
                    setActiveProject(null);
                  } catch (err) { setError(err.message); }
                }}
              >
                <X size={13} /> Leave Project
              </div>
            )}
          </>
        )}

        <div
          style={{ marginTop:"auto", padding:"14px 16px", borderTop:"1px solid rgba(255,255,255,0.12)", display:"flex", alignItems:"center", gap:9, cursor:"pointer" }}
          onClick={() => { setShowProfile(true); setProfileTab("avatar"); setProfileMsg({ type:"", text:"" }); }}
          title="My Profile"
        >
          {user.avatar_url
            ? <img src={`${API_ORIGIN}${user.avatar_url}`} alt="avatar" style={{ width:30, height:30, borderRadius:"50%", objectFit:"cover", border:"2px solid rgba(255,255,255,0.4)", flexShrink:0 }} />
            : <div className="pm-avatar" style={{ background: user.color, marginLeft:0, border:"none", flexShrink:0 }}>{user.initials}</div>
          }
          <div style={{ fontSize:12, flex:1, color:"rgba(255,255,255,0.85)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.name}</div>
          <LogOut size={14} style={{ cursor:"pointer", color:"rgba(255,255,255,0.5)", flexShrink:0 }} onClick={(e) => { e.stopPropagation(); onLogout(); }} />
        </div>

        {/* Resize handle */}
        <div className="pm-sidebar-resize" onMouseDown={startSidebarResize} />
      </aside>

      {/* Sidebar collapse-expand toggle */}
      <div
        className={`pm-sidebar-toggle${sidebarCollapsed ? " collapsed" : ""}`}
        style={{ left: sidebarCollapsed ? 0 : sidebarWidth }}
        onClick={() => setSidebarCollapsed((v) => !v)}
        title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
      >
        {sidebarCollapsed ? "›" : "‹"}
      </div>

      <div className="pm-main">
        {error && <div className="pm-error-banner">{error} <span style={{cursor:"pointer", fontWeight:600}} onClick={() => setError("")}> Dismiss</span></div>}
        {!user.is_verified && (
          <div className="pm-verify-banner">
            ⚠ Please verify your email address.{" "}
            <span className="pm-verify-link" onClick={async () => {
              try { await api.resendVerification(token); setError(""); alert("Verification email sent!"); }
              catch (e) { setError(e.message); }
            }}>Resend verification email</span>
          </div>
        )}
        <div className="pm-topbar">
          <div className="pm-topbar-row1">
            <div className="pm-title pm-serif">
              {activeProject ? activeProject.name : "No project selected"}
              {activeProject && (
                <Edit2
                  size={13}
                  style={{ marginLeft: 9, cursor: "pointer", color: "var(--muted)", verticalAlign: "middle" }}
                  title="Rename project"
                  onClick={() => { setRenameValue(activeProject.name); setShowRenameProject(true); }}
                />
              )}
              <span className="ruleline" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div className="pm-search">
                <Search size={14} />
                <input
                  placeholder="Search tasks…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setSearchQuery("")}
                />
                {searchQuery && (
                  <X size={13} style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => setSearchQuery("")} />
                )}
              </div>
              <div className="pm-avatars">
                {members.map((m) => (
                  <div key={m.id} className="pm-avatar" style={{ background: m.color }} title={m.name}>{m.initials}</div>
                ))}
              </div>
              <div style={{ position: "relative" }} title="Project invitations">
                <div
                  className="pm-bell-btn"
                  onClick={(e) => { e.stopPropagation(); setShowInvites((v) => !v); }}
                  style={{ position:"relative" }}
                >
                  <Mail size={15} />
                  {pendingInvites.length > 0 && (
                    <span className="pm-bell-badge" style={{ background:"#EF4444" }}>{pendingInvites.length}</span>
                  )}
                </div>
                {showInvites && (
                  <div
                    className="pm-bell-dropdown"
                    style={{ width: 320, right: 0, top: 40 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="pm-bell-head" style={{ padding:"12px 16px 10px" }}>
                      <span className="pm-bell-title">Project Invitations</span>
                      {pendingInvites.length > 0 && (
                        <span style={{ fontSize:11, background:"#EF4444", color:"#fff", borderRadius:999, padding:"2px 8px", fontWeight:700 }}>
                          {pendingInvites.length} pending
                        </span>
                      )}
                    </div>
                    {pendingInvites.length === 0 && (
                      <div className="pm-bell-empty">No pending invitations.</div>
                    )}
                    {pendingInvites.map((inv) => (
                      <div key={inv.id} style={{ padding:"14px 16px", borderBottom:"1px solid var(--border)", background:"#F8FCFF" }}>
                        <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:10 }}>
                          <div style={{ width:36, height:36, borderRadius:8, background:"linear-gradient(135deg,#1A7FA8,#0B4F6C)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:16, flexShrink:0 }}>📁</div>
                          <div>
                            <div style={{ fontSize:13.5, fontWeight:700, color:"var(--teal-deep)", lineHeight:1.2 }}>{inv.project_name}</div>
                            <div style={{ fontSize:11.5, color:"var(--muted)", marginTop:2 }}>
                              Invited by <strong>{inv.invited_by_name || "a member"}</strong>
                            </div>
                            <div style={{ fontSize:10.5, color:"#B0C8D8", marginTop:1 }}>
                              Role: {inv.role} · {new Date(inv.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:8 }}>
                          <button
                            onClick={() => { acceptInvite(inv.id); setShowInvites(false); }}
                            style={{ flex:1, padding:"9px 0", background:"linear-gradient(135deg,#1A7FA8,#0B4F6C)", color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}
                          >
                            <Check size={14} /> Accept
                          </button>
                          <button
                            onClick={() => declineInvite(inv.id)}
                            style={{ flex:1, padding:"9px 0", background:"#F1F5F9", color:"#64748B", border:"1.5px solid #CBD5E1", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer" }}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <NotificationBell
                token={token}
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkRead={markNotificationRead}
                onMarkAllRead={markAllNotificationsRead}
                onDismiss={dismissNotification}
                onClearAll={clearAllNotifications}
              />
              {activeProject && (
                <>
                  <button className="pm-btn-ghost" onClick={exportCurrentViewAsPDF} title="Export current view as PDF">
                    <FileText size={14} /> Export PDF
                  </button>
                  <button className="pm-btn-ghost" onClick={openReport} title="Generate a full project report">
                    <FileText size={14} /> Report
                  </button>
                </>
              )}
              {!isViewer && (
                <button className="pm-btn-ghost" onClick={openImportTasks} disabled={!activeProject}>
                  <FileUp size={14} /> Import Tasks
                </button>
              )}
              {!isViewer && (
                <button className="pm-btn-primary" onClick={() => openNewTask("todo")} disabled={!activeProject}>
                  <Plus size={15} /> New Task
                </button>
              )}
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
        ) : searchResults !== null ? (
          <div className="pm-search-results">
            <div className="pm-search-header">
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "{searchQuery}"
            </div>
            {searchResults.length === 0 && (
              <div style={{ color: "var(--muted)", fontSize: 13 }}>No tasks match your search.</div>
            )}
            {searchResults.map((t) => (
              <div className="pm-search-task-row" key={t.id} onClick={() => setSelectedTask(t)}>
                <span className="pm-search-status" style={{ background: STATUS_COLORS[t.status] }}>{STATUS_LABELS[t.status]}</span>
                <span style={{ fontWeight: 600, fontSize: 13.5, flex: 1 }}>{t.title}</span>
                <span className="pm-pri-dot" style={{ background: PRIORITY_COLOR[t.priority], width: 8, height: 8, borderRadius: "50%", display: "inline-block" }} />
                {t.assignee_initials && (
                  <span className="pm-card-avatar" style={{ background: t.assignee_color, width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9.5, fontWeight: 700 }}>{t.assignee_initials}</span>
                )}
              </div>
            ))}
          </div>
        ) : activeView === "kanban" ? (
          <div className="pm-board">
            {COLUMNS.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col.id);
              return (
                <div
                  key={col.id}
                  className={`pm-col ${dragOverCol === col.id ? "dragover" : ""}`}
                  style={{ width: colWidths[col.id] }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id); }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={() => { if (dragTaskId.current) { moveTask(dragTaskId.current, col.id); setDragOverCol(null); } }}
                >
                  <div className="pm-col-resize" onMouseDown={(e) => startColResize(e, col.id)} />
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
                      <div
                        key={t.id}
                        className="pm-card"
                        draggable={!isViewer}
                        onDragStart={() => (dragTaskId.current = t.id)}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={(e) => !isViewer && handleCardDrop(e, col.id, t)}
                        onClick={() => setSelectedTask(t)}
                        style={{ position: "relative" }}
                      >
                        {taskUnreadCounts[t.id] > 0 && (
                          <span className="pm-task-badge">
                            {taskUnreadCounts[t.id] > 9 ? "9+" : taskUnreadCounts[t.id]}
                          </span>
                        )}
                        <div className="pm-flag" style={{ background: PRIORITY_COLOR[t.priority] }} title={`${t.priority} priority`} />
                        <Trash2
                          size={12}
                          className="pm-card-del"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete "${t.title}"?`)) deleteTask(t.id);
                          }}
                        />
                        <div className="pm-card-title">{t.title}</div>
                        <div className="pm-labels">
                          {t.category === "complex" && (
                            <span style={{ fontSize:10, padding:"2px 7px", borderRadius:5, background:"#FEF3C7", color:"#92400E", fontWeight:700, border:"1px solid #FDE68A" }}>Complex</span>
                          )}
                          {t.category === "simple" && (
                            <span style={{ fontSize:10, padding:"2px 7px", borderRadius:5, background:"#D1FAE5", color:"#065F46", fontWeight:700, border:"1px solid #A7F3D0" }}>Simple</span>
                          )}
                          {t.labels && t.labels.map((l) => <span className="pm-label-chip" key={l.id}>{l.name}</span>)}
                        </div>
                        <div className="pm-card-foot">
                          <div className="pm-card-meta">
                            {t.start_date && <span className="pm-card-meta-item" style={{color:"#10B981"}}><Calendar size={11} /> {formatDue(t.start_date)}</span>}
                            {t.due_date && <span className="pm-card-meta-item"><Calendar size={11} /> {formatDue(t.due_date)}</span>}
                            {Number(t.comment_count) > 0 && <span className="pm-card-meta-item"><MessageSquare size={11} /> {t.comment_count}</span>}
                            {Number(t.attachment_count) > 0 && <span className="pm-card-meta-item"><Paperclip size={11} /> {t.attachment_count}</span>}
                          </div>
                          {t.assignee_team_id ? (
                            <div className="pm-card-team" style={{ background: t.team_color }} title={t.team_name}>
                              <Users size={10} /> {t.team_name}
                            </div>
                          ) : t.assignee_initials ? (
                            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                              <div className="pm-card-avatar" style={{ background: t.assignee_color }}>{t.assignee_initials}</div>
                              <span style={{ fontSize:10.5, color:"var(--muted)", fontWeight:500, maxWidth:70, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                {t.assignee_name ? t.assignee_name.split(" ")[0] : ""}
                              </span>
                            </div>
                          ) : null}
                        </div>
                        {/* Shortcut action buttons — appear on card hover, icon-only */}
                        {!isViewer && (
                          <div className="pm-card-actions">
                            <button className="pm-card-action-btn" onClick={(e) => openCardPopover(e, t.id, "status")} title="Change Status"><RotateCw size={13} /></button>
                            <button className="pm-card-action-btn" onClick={(e) => openCardPopover(e, t.id, "priority")} title="Change Priority"><Flag size={13} /></button>
                            <button className="pm-card-action-btn" onClick={(e) => openCardPopover(e, t.id, "assignee")} title="Change Assignee"><User size={13} /></button>
                            <button className="pm-card-action-btn" onClick={(e) => { e.stopPropagation(); setSelectedTask(t); setTimeout(()=>fileInputRef.current?.click(),100); }} title="Add Attachment"><Paperclip size={13} /></button>
                            <button className="pm-card-action-btn" onClick={(e) => openCardPopover(e, t.id, "comment")} title="Write Comment"><MessageSquare size={13} /></button>
                            <button className="pm-card-action-btn" onClick={(e) => openCardPopover(e, t.id, "subtask")} title="Add Subtask"><CheckSquare size={13} /></button>
                          </div>
                        )}
                        {/* Subtask mini-list with checkboxes */}
                        {t.subtasks && t.subtasks.length > 0 && (
                          <div style={{ margin:"6px 0 4px", borderTop:"1px solid var(--border)", paddingTop:5 }}>
                            {t.subtasks.slice(0, 4).map((s) => (
                              <div key={s.id} style={{ padding:"3px 0", borderBottom:"1px solid #EEF6FC" }}>
                                <div
                                  style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}
                                  onClick={(e) => { e.stopPropagation(); setSelectedTask(t); }}
                                >
                                  <span
                                    style={{ color: s.is_done ? "var(--teal)" : "var(--muted)", flexShrink:0, display:"flex" }}
                                    onClick={(e) => { e.stopPropagation(); if (!isViewer) toggleSubtask(s.id, !s.is_done); }}
                                  >
                                    {s.is_done ? <CheckSquare size={12} /> : <Square size={12} />}
                                  </span>
                                  <span style={{ fontSize:11, flex:1, color: s.is_done ? "var(--muted)" : "var(--ink)", textDecoration: s.is_done ? "line-through" : "none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                    {s.title}
                                  </span>
                                </div>
                                {s.target_at && !s.is_done && (
                                  <div className="pm-subtask-meta" style={{ paddingLeft:18 }}>
                                    🎯 {new Date(s.target_at).toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}
                                  </div>
                                )}
                                {s.is_done && s.target_at && (
                                  <div className="pm-subtask-meta completed" style={{ paddingLeft:18 }}>
                                    ✓ Completed {new Date(s.target_at).toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}
                                  </div>
                                )}
                              </div>
                            ))}
                            {t.subtasks.length > 4 && (
                              <div style={{ fontSize:10, color:"var(--muted)", paddingLeft:18 }}>+{t.subtasks.length - 4} more</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {!isViewer && (
                    <div className="pm-quickadd">
                      <input
                        placeholder="+ Add a task…"
                        value={quickAdd[col.id] || ""}
                        onChange={(e) => setQuickAdd((q) => ({ ...q, [col.id]: e.target.value }))}
                        onFocus={() => { openNewTask(col.id); setQuickAdd((q) => ({ ...q, [col.id]: "" })); }}
                        readOnly
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : activeView === "list" ? (
          <ListView tasks={tasks} onSelect={setSelectedTask} />
        ) : activeView === "calendar" ? (
          <CalendarView
            tasks={tasks}
            onSelect={(t) => {
              const full = tasks.find((x) => x.id === t.id) || t;
              setSelectedTask(full);
            }}
            onCreateDate={isViewer ? undefined : (dateKey) => {
              setNewTaskStatus("todo");
              setNewTaskForm({ title:"", description:"", priority:"medium", assigneeId:"", assigneeTeamId:"", startDate: dateKey, dueDate: dateKey, category:"simple" });
              setShowNewTask(true);
            }}
          />
        ) : activeView === "timeline" ? (
          <TimelineView tasks={tasks} onSelect={setSelectedTask} />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 14 }}>
            {activeView.charAt(0).toUpperCase() + activeView.slice(1)} view — coming next.
          </div>
        )}
      </div>

      {/* -- New Project Modal -- */}
      {showNewProject && (
        <div className="pm-modal-overlay" onClick={() => setShowNewProject(false)}>
          <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pm-modal-head">
              <div className="pm-modal-title">New Project</div>
              <X size={18} style={{ cursor:"pointer", color:"var(--muted)" }} onClick={() => setShowNewProject(false)} />
            </div>
            <div className="pm-modal-body">
              <div className="pm-field-row">
                <label>Project Name *</label>
                <input
                  autoFocus
                  placeholder="e.g. Water Distribution Upgrade"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitNewProject()}
                />
              </div>
              <div className="pm-field-row">
                <label>Description (optional)</label>
                <textarea
                  placeholder="Brief description of this project…"
                  value={newProjDesc}
                  onChange={(e) => setNewProjDesc(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="pm-modal-footer">
                <button className="pm-btn-cancel" onClick={() => setShowNewProject(false)}>Cancel</button>
                <button className="pm-btn-primary" onClick={submitNewProject} disabled={!newProjName.trim()}>
                  <Plus size={14} /> Create Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -- New Task Modal -- */}
      {showNewTask && (
        <div className="pm-modal-overlay" onClick={() => setShowNewTask(false)}>
          <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pm-modal-head">
              <div className="pm-modal-title">Create New Task</div>
              <X size={18} style={{ cursor:"pointer", color:"var(--muted)" }} onClick={() => setShowNewTask(false)} />
            </div>
            <div className="pm-modal-body">
              <div className="pm-field-row">
                <label>Task Title *</label>
                <input
                  autoFocus
                  placeholder="What needs to be done?"
                  value={newTaskForm.title}
                  onChange={(e) => setNewTaskForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="pm-field-row">
                <label>Description</label>
                <textarea
                  placeholder="Add more details…"
                  value={newTaskForm.description}
                  onChange={(e) => setNewTaskForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="pm-field-row-2col">
                <div className="pm-field-row" style={{ marginBottom:0 }}>
                  <label>Status</label>
                  <select value={newTaskStatus} onChange={(e) => setNewTaskStatus(e.target.value)}>
                    {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div className="pm-field-row" style={{ marginBottom:0 }}>
                  <label>Priority</label>
                  <select value={newTaskForm.priority} onChange={(e) => setNewTaskForm((f) => ({ ...f, priority: e.target.value }))}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="pm-field-row">
                <label>Assignee</label>
                <select
                  value={newTaskForm.assigneeTeamId ? `team-${newTaskForm.assigneeTeamId}` : newTaskForm.assigneeId ? `user-${newTaskForm.assigneeId}` : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) setNewTaskForm((f) => ({ ...f, assigneeId:"", assigneeTeamId:"" }));
                    else if (v.startsWith("team-")) setNewTaskForm((f) => ({ ...f, assigneeTeamId: v.slice(5), assigneeId:"" }));
                    else setNewTaskForm((f) => ({ ...f, assigneeId: v.slice(5), assigneeTeamId:"" }));
                  }}
                >
                  <option value="">Unassigned</option>
                  {members.length > 0 && <optgroup label="People">{members.map((m) => <option key={m.id} value={`user-${m.id}`}>{m.name}</option>)}</optgroup>}
                  {teams.length > 0 && <optgroup label="Teams">{teams.map((t) => <option key={t.id} value={`team-${t.id}`}>{t.name}</option>)}</optgroup>}
                </select>
              </div>
              <div className="pm-field-row-2col">
                <div className="pm-field-row" style={{ marginBottom:0 }}>
                  <label>Start Date</label>
                  <input type="date" value={newTaskForm.startDate} onChange={(e) => setNewTaskForm((f) => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div className="pm-field-row" style={{ marginBottom:0 }}>
                  <label>Due Date</label>
                  <input type="date" value={newTaskForm.dueDate} onChange={(e) => setNewTaskForm((f) => ({ ...f, dueDate: e.target.value }))} />
                </div>
              </div>
              <div className="pm-field-row">
                <label>Category</label>
                <select value={newTaskForm.category} onChange={(e) => setNewTaskForm((f) => ({ ...f, category: e.target.value }))}>
                  <option value="simple">Simple</option>
                  <option value="complex">Complex</option>
                </select>
              </div>
              <div className="pm-field-row">
                <label>Subtasks</label>
                <div>
                  {newTaskSubtasks.map((s, idx) => (
                    <div key={idx} style={{ display:"flex", alignItems:"flex-start", gap:7, marginBottom:6, background:"var(--paper-deep)", borderRadius:7, padding:"6px 8px" }}>
                      <Square size={12} style={{ color:"var(--muted)", flexShrink:0, marginTop:3 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12.5, fontWeight:600 }}>{s.title}</div>
                        {s.targetAt && (
                          <div style={{ fontSize:10.5, color:"#7C3AED" }}>
                            🎯 {new Date(s.targetAt).toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}
                          </div>
                        )}
                      </div>
                      <X size={12} style={{ cursor:"pointer", color:"var(--muted)", flexShrink:0, marginTop:3 }} onClick={() => { const fi=idx; setNewTaskSubtasks((prev) => prev.filter((_,k) => k!==fi)); }} />
                    </div>
                  ))}
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    <input
                      placeholder="Subtask title…"
                      value={newTaskSubInput}
                      onChange={(e) => setNewTaskSubInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newTaskSubInput.trim()) {
                          setNewTaskSubtasks((prev) => [...prev, { title: newTaskSubInput.trim(), targetAt: fromLocalInputValue(newTaskSubTargetAt) }]);
                          setNewTaskSubInput(""); setNewTaskSubTargetAt("");
                        }
                      }}
                      style={{ width:"100%", border:"1.5px dashed var(--border)", borderRadius:8, padding:"7px 10px", fontSize:12.5, outline:"none", fontFamily:"inherit" }}
                    />
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <input
                        type="datetime-local"
                        value={newTaskSubTargetAt}
                        onChange={(e) => setNewTaskSubTargetAt(e.target.value)}
                        style={{ flex:1, border:"1.5px dashed var(--border)", borderRadius:8, padding:"6px 10px", fontSize:12, outline:"none", fontFamily:"inherit", color:"var(--muted)" }}
                        title="Target date & time (optional)"
                      />
                      <button
                        type="button"
                        className="pm-btn-ghost"
                        style={{ padding:"7px 14px", fontSize:12.5, whiteSpace:"nowrap" }}
                        onClick={() => {
                          if (newTaskSubInput.trim()) {
                            setNewTaskSubtasks((prev) => [...prev, { title: newTaskSubInput.trim(), targetAt: fromLocalInputValue(newTaskSubTargetAt) }]);
                            setNewTaskSubInput(""); setNewTaskSubTargetAt("");
                          }
                        }}
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pm-field-row">
                <label>Attach Files</label>
                <input
                  ref={newTaskFileRef}
                  type="file"
                  multiple
                  style={{ display:"none" }}
                  onChange={(e) => setNewTaskFiles(Array.from(e.target.files))}
                />
                <div
                  onClick={() => newTaskFileRef.current?.click()}
                  style={{ border:"1.5px dashed var(--border)", borderRadius:9, padding:"10px 14px", cursor:"pointer", color:"var(--muted)", fontSize:13, display:"flex", alignItems:"center", gap:8, background:"#F8FCFF" }}
                >
                  <Paperclip size={14} />
                  {newTaskFiles.length === 0 ? "Click to attach files…" : `${newTaskFiles.length} file${newTaskFiles.length > 1 ? "s" : ""} selected`}
                </div>
                {newTaskFiles.length > 0 && (
                  <div style={{ marginTop:6, display:"flex", flexWrap:"wrap", gap:5 }}>
                    {newTaskFiles.map((f, i) => {
                      const fi = i;
                      return (
                      <span key={i} style={{ fontSize:11, background:"var(--paper-deep)", border:"1px solid var(--border)", borderRadius:5, padding:"2px 8px", display:"flex", alignItems:"center", gap:4 }}>
                        {f.name}
                        <X size={10} style={{ cursor:"pointer" }} onClick={() => setNewTaskFiles((prev) => prev.filter((_, j) => j !== fi))} />
                      </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="pm-field-row">
                <label>Attach Links</label>
                <div>
                  {newTaskLinks.map((l, idx) => (
                    <div key={idx} style={{ display:"flex", alignItems:"center", gap:7, marginBottom:6, background:"#EFF8FF", border:"1px solid #BFDBFE", borderRadius:8, padding:"6px 10px" }}>
                      <span style={{ flex:1, minWidth:0, fontSize:12.5, fontWeight:600, color:"#1D4ED8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        🔗 {l.label}
                      </span>
                      <X size={12} style={{ cursor:"pointer", color:"var(--muted)", flexShrink:0 }} onClick={() => { const fi=idx; setNewTaskLinks((prev) => prev.filter((_,k) => k!==fi)); }} />
                    </div>
                  ))}
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    <input
                      placeholder="Link name (e.g. Google Drive folder)"
                      value={newTaskLinkLabel}
                      onChange={(e) => setNewTaskLinkLabel(e.target.value)}
                      style={{ width:"100%", border:"1.5px dashed var(--border)", borderRadius:8, padding:"7px 10px", fontSize:12.5, outline:"none", fontFamily:"inherit" }}
                    />
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <input
                        placeholder="URL (e.g. https://…)"
                        value={newTaskLinkUrl}
                        onChange={(e) => setNewTaskLinkUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newTaskLinkLabel.trim() && newTaskLinkUrl.trim()) {
                            setNewTaskLinks((prev) => [...prev, { label: newTaskLinkLabel.trim(), url: newTaskLinkUrl.trim() }]);
                            setNewTaskLinkLabel(""); setNewTaskLinkUrl("");
                          }
                        }}
                        style={{ flex:1, border:"1.5px dashed var(--border)", borderRadius:8, padding:"7px 10px", fontSize:12.5, outline:"none", fontFamily:"inherit" }}
                      />
                      <button
                        type="button"
                        className="pm-btn-ghost"
                        style={{ padding:"7px 14px", fontSize:12.5, whiteSpace:"nowrap" }}
                        onClick={() => {
                          if (newTaskLinkLabel.trim() && newTaskLinkUrl.trim()) {
                            setNewTaskLinks((prev) => [...prev, { label: newTaskLinkLabel.trim(), url: newTaskLinkUrl.trim() }]);
                            setNewTaskLinkLabel(""); setNewTaskLinkUrl("");
                          }
                        }}
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pm-modal-footer" style={{ marginTop:18 }}>
                <button className="pm-btn-cancel" onClick={() => { setShowNewTask(false); setNewTaskFiles([]); setNewTaskLinks([]); }}>Cancel</button>
                <button className="pm-btn-primary" onClick={submitNewTask} disabled={!newTaskForm.title.trim()}>
                  <Plus size={14} /> Create Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -- Import Tasks Modal -- */}
      {showImportTasks && (
        <div className="pm-modal-overlay" onClick={() => setShowImportTasks(false)}>
          <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pm-modal-head">
              <div className="pm-modal-title">Import Tasks</div>
              <X size={18} style={{ cursor:"pointer", color:"var(--muted)" }} onClick={() => setShowImportTasks(false)} />
            </div>
            <div className="pm-modal-body">
              {!importResult && (
                <>
                  <div style={{ fontSize:12.5, color:"var(--muted)", marginBottom:14, lineHeight:1.6 }}>
                    Import tasks in bulk from a CSV file (opens and edits fine in Excel or Google Sheets).
                    Start from the template below — it covers every task field, including subtasks and labels.
                  </div>
                  <a
                    href="/task-import-template.csv"
                    download="task-import-template.csv"
                    className="pm-btn-ghost"
                    style={{ width:"fit-content", marginBottom:16, textDecoration:"none" }}
                  >
                    <Download size={13} /> Download CSV Template
                  </a>

                  <div className="pm-field-row">
                    <label>CSV File</label>
                    <input
                      ref={importFileRef}
                      type="file"
                      accept=".csv,text/csv"
                      style={{ display:"none" }}
                      onChange={handleImportFileSelected}
                    />
                    <div
                      onClick={() => importFileRef.current && importFileRef.current.click()}
                      style={{ border:"1.5px dashed var(--border)", borderRadius:9, padding:"10px 14px", cursor:"pointer", color:"var(--muted)", fontSize:13, display:"flex", alignItems:"center", gap:8, background:"#F8FCFF" }}
                    >
                      <FileUp size={14} />
                      {importFileName || "Click to choose a .csv file…"}
                    </div>
                  </div>

                  {importError && <div style={{ fontSize:12.5, color:"#DC2626", marginTop:6 }}>{importError}</div>}

                  {importRows.length > 0 && !importError && (
                    <div style={{ marginTop:14 }}>
                      <div style={{ fontSize:12.5, fontWeight:600, marginBottom:8 }}>
                        Ready to import {importRows.length} task{importRows.length === 1 ? "" : "s"}:
                      </div>
                      <div style={{ maxHeight:180, overflowY:"auto", border:"1px solid var(--border)", borderRadius:9 }}>
                        {importRows.slice(0, 20).map((r, i) => (
                          <div key={i} style={{ padding:"6px 10px", fontSize:12, borderBottom: i < importRows.length - 1 ? "1px solid var(--border)" : "none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {r.title || <span style={{ color:"#DC2626" }}>(missing title)</span>}
                          </div>
                        ))}
                        {importRows.length > 20 && (
                          <div style={{ padding:"6px 10px", fontSize:11.5, color:"var(--muted)" }}>+{importRows.length - 20} more…</div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pm-modal-footer" style={{ marginTop:18 }}>
                    <button className="pm-btn-cancel" onClick={() => setShowImportTasks(false)}>Cancel</button>
                    <button className="pm-btn-primary" onClick={submitImportTasks} disabled={importRows.length === 0 || importing}>
                      <FileUp size={14} /> {importing ? "Importing…" : `Import ${importRows.length || ""} Task${importRows.length === 1 ? "" : "s"}`}
                    </button>
                  </div>
                </>
              )}

              {importResult && (
                <>
                  <div style={{ fontSize:14, fontWeight:700, color: importResult.createdCount > 0 ? "#3F7D52" : "#DC2626", marginBottom:10 }}>
                    {importResult.createdCount} task{importResult.createdCount === 1 ? "" : "s"} imported
                    {importResult.errorCount > 0 && `, ${importResult.errorCount} row${importResult.errorCount === 1 ? "" : "s"} skipped`}
                  </div>
                  {importResult.warnings?.length > 0 && (
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:"#B45309", marginBottom:4 }}>Warnings</div>
                      {importResult.warnings.map((w, i) => (
                        <div key={i} style={{ fontSize:12, color:"#B45309" }}>Row {w.row}: {w.message}</div>
                      ))}
                    </div>
                  )}
                  {importResult.errors?.length > 0 && (
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:"#DC2626", marginBottom:4 }}>Skipped rows</div>
                      {importResult.errors.map((e, i) => (
                        <div key={i} style={{ fontSize:12, color:"#DC2626" }}>Row {e.row}: {e.message}</div>
                      ))}
                    </div>
                  )}
                  <div className="pm-modal-footer" style={{ marginTop:10 }}>
                    <button className="pm-btn-primary" onClick={() => setShowImportTasks(false)}>Done</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* -- Card Quick-Action Popover -- */}
      {cardPopover && (() => {
        const t = tasks.find((x) => x.id === cardPopover.taskId);
        if (!t) return null;
        return (
          <div
            style={{ position:"fixed", inset:0, zIndex:150 }}
            onClick={closeCardPopover}
          >
            <div
              className={`pm-card-popover${cardPopover.type === "comment" || cardPopover.type === "subtask" ? " type-comment" : ""}`}
              style={{
                top: Math.min(cardPopover.y, window.innerHeight - 200),
                left: Math.min(cardPopover.x, window.innerWidth - (cardPopover.type === "comment" || cardPopover.type === "subtask" ? 270 : 215)),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontWeight:700, fontSize:11.5, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6, paddingBottom:6, borderBottom:"1px solid var(--border)" }}>
                {cardPopover.type === "status" ? "Change Status" :
                 cardPopover.type === "priority" ? "Change Priority" :
                 cardPopover.type === "assignee" ? "Change Assignee" :
                 cardPopover.type === "subtask" ? "Add Subtask" : "Write Comment"}
              </div>

              {cardPopover.type === "status" && COLUMNS.map((c) => (
                <div key={c.id} className={`pm-pop-option ${t.status===c.id?"active":""}`}
                  onClick={() => { closeCardPopover(); requestStatusChange(t.id, c.id, t.title); }}>
                  <span style={{ width:9, height:9, borderRadius:"50%", background:c.accent, display:"inline-block", flexShrink:0 }} />
                  {c.label} {t.status===c.id && "✓"}
                </div>
              ))}

              {cardPopover.type === "priority" && ["high","medium","low"].map((p) => (
                <div key={p} className={`pm-pop-option ${t.priority===p?"active":""}`}
                  onClick={() => cardPopoverPatch(t.id, { priority: p })}>
                  <span style={{ width:9, height:9, borderRadius:"50%", background:PRIORITY_COLOR[p], display:"inline-block", flexShrink:0 }} />
                  {p.charAt(0).toUpperCase()+p.slice(1)} {t.priority===p && "✓"}
                </div>
              ))}

              {cardPopover.type === "assignee" && (
                <>
                  <div className="pm-pop-option" onClick={() => cardPopoverPatch(t.id, { assigneeId:null, assigneeTeamId:null })}>
                    — Unassigned {!t.assignee_id && !t.assignee_team_id && "✓"}
                  </div>
                  {members.length > 0 && <div style={{ fontSize:10.5, color:"var(--muted)", padding:"4px 10px", fontWeight:600, textTransform:"uppercase" }}>People</div>}
                  {members.map((m) => (
                    <div key={m.id} className={`pm-pop-option ${t.assignee_id===m.id?"active":""}`}
                      onClick={() => cardPopoverPatch(t.id, { assigneeId: m.id })}>
                      <span style={{ width:20, height:20, borderRadius:"50%", background:m.color, color:"#fff", fontSize:9, fontWeight:700, display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{m.initials}</span>
                      {m.name} {t.assignee_id===m.id && "✓"}
                    </div>
                  ))}
                  {teams.length > 0 && <div style={{ fontSize:10.5, color:"var(--muted)", padding:"4px 10px", fontWeight:600, textTransform:"uppercase" }}>Teams</div>}
                  {teams.map((tm) => (
                    <div key={tm.id} className={`pm-pop-option ${t.assignee_team_id===tm.id?"active":""}`}
                      onClick={() => cardPopoverPatch(t.id, { assigneeTeamId: tm.id })}>
                      <span style={{ width:9, height:9, borderRadius:3, background:tm.color, display:"inline-block", flexShrink:0 }} />
                      {tm.name} {t.assignee_team_id===tm.id && "✓"}
                    </div>
                  ))}
                </>
              )}

              {cardPopover.type === "comment" && (
                <>
                  <textarea
                    className="pm-pop-textarea"
                    autoFocus
                    rows={3}
                    placeholder="Write a comment…"
                    value={popoverComment}
                    onChange={(e) => setPopoverComment(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submitCardComment(); }}
                  />
                  <button className="pm-btn-primary" style={{ width:"100%", padding:"8px 0", fontSize:13 }} onClick={submitCardComment}>
                    Post Comment
                  </button>
                </>
              )}

              {cardPopover.type === "subtask" && (
                <>
                  <input
                    autoFocus
                    placeholder="Subtask title…"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    style={{ width:"100%", border:"1px solid var(--border)", borderRadius:8, padding:"7px 9px", fontSize:12.5, outline:"none", marginBottom:7, fontFamily:"'Inter',sans-serif" }}
                  />
                  <input
                    type="datetime-local"
                    value={newSubtaskTarget}
                    onChange={(e) => setNewSubtaskTarget(e.target.value)}
                    style={{ width:"100%", border:"1px dashed var(--border)", borderRadius:8, padding:"6px 9px", fontSize:11.5, outline:"none", marginBottom:7 }}
                    title="Target completion date/time (optional)"
                  />
                  <button
                    className="pm-btn-primary"
                    style={{ width:"100%", padding:"8px 0", fontSize:13 }}
                    onClick={async () => {
                      if (!newSubtask.trim()) return;
                      try {
                        await api.createSubtask(token, t.id, newSubtask.trim(), fromLocalInputValue(newSubtaskTarget));
                        setNewSubtask(""); setNewSubtaskTarget("");
                        refreshTasks();
                      } catch (err) { setError(err.message); }
                      closeCardPopover();
                    }}
                  >
                    Add Subtask
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* -- Status Change Confirmation -- */}
      {/* -- Completion Date-Time Picker Widget -- */}
      {completionPicker && (() => {
        const sub = subtasks.find((s) => s.id === completionPicker.subtaskId) ||
          tasks.flatMap((t) => t.subtasks || []).find((s) => s.id === completionPicker.subtaskId);
        return (
          <div className="pm-completion-overlay" onClick={() => setCompletionPicker(null)}>
            <div className="pm-completion-widget" onClick={(e) => e.stopPropagation()}>
              <div className="pm-completion-title">Mark Subtask Complete</div>
              <div className="pm-completion-sub">
                {sub ? `"${sub.title}"` : "Subtask"} — when was this completed?
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:11.5, color:"var(--muted)", fontWeight:600, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.05em" }}>
                  Completion Date &amp; Time
                </label>
                <input
                  type="datetime-local"
                  value={completionPicker.value}
                  onChange={(e) => setCompletionPicker((prev) => ({ ...prev, value: e.target.value }))}
                  style={{ width:"100%", border:"1.5px solid var(--border)", borderRadius:9, padding:"9px 12px", fontSize:14, outline:"none", fontFamily:"inherit" }}
                  autoFocus
                />
              </div>
              <div style={{ display:"flex", gap:9 }}>
                <button
                  className="pm-btn-cancel"
                  style={{ flex:1, padding:"9px 0" }}
                  onClick={() => setCompletionPicker(null)}
                >
                  Cancel
                </button>
                <button
                  className="pm-btn-primary"
                  style={{ flex:1, padding:"9px 0", justifyContent:"center" }}
                  onClick={confirmSubtaskCompletion}
                >
                  <CheckSquare size={14} /> Mark Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* -- Edit Subtask Modal -- */}
      {editingSubtask && (
        <div className="pm-modal-overlay" onClick={() => setEditingSubtask(null)}>
          <div className="pm-modal" style={{ maxWidth:400 }} onClick={(e) => e.stopPropagation()}>
            <div className="pm-modal-head">
              <div className="pm-modal-title">Edit Subtask</div>
              <X size={18} style={{ cursor:"pointer", color:"var(--muted)" }} onClick={() => setEditingSubtask(null)} />
            </div>
            <div className="pm-modal-body">
              <div className="pm-field-row">
                <label>Title</label>
                <input
                  autoFocus
                  value={editingSubtask.title}
                  onChange={(e) => setEditingSubtask((prev) => ({ ...prev, title: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && saveSubtaskEdit()}
                />
              </div>
              <div className="pm-field-row">
                <label>Target Date &amp; Time</label>
                <input
                  type="datetime-local"
                  value={editingSubtask.target_at || ""}
                  onChange={(e) => setEditingSubtask((prev) => ({ ...prev, target_at: e.target.value }))}
                />
              </div>
              <div className="pm-modal-footer">
                <button className="pm-btn-cancel" onClick={() => setEditingSubtask(null)}>Cancel</button>
                <button className="pm-btn-primary" onClick={saveSubtaskEdit} disabled={!editingSubtask.title.trim()}>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pendingStatusChange && (
        <div className="pm-modal-overlay" onClick={() => setPendingStatusChange(null)}>
          <div className="pm-modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="pm-modal-body" style={{ paddingTop: 24, textAlign: "center" }}>
              <div style={{ width:48, height:48, borderRadius:"50%", background:"#DBEAFE", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
                <RotateCw size={22} color="#1D4ED8" />
              </div>
              <div style={{ fontSize:15, fontWeight:700, color:"var(--teal-deep)", marginBottom:6 }}>Update task status?</div>
              <div style={{ fontSize:13, color:"var(--muted)", marginBottom:20, lineHeight:1.5 }}>
                Move "<strong>{pendingStatusChange.title}</strong>" to <strong>{STATUS_LABELS[pendingStatusChange.status]}</strong>?
              </div>
              <div className="pm-modal-footer" style={{ justifyContent:"center" }}>
                <button className="pm-btn-cancel" onClick={() => setPendingStatusChange(null)}>Cancel</button>
                <button className="pm-btn-primary" onClick={confirmStatusChange}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -- Rename Project Modal -- */}
      {/* -- Profile Modal -- */}
      {showProfile && (
        <div className="pm-modal-overlay" onClick={() => setShowProfile(false)}>
          <div className="pm-modal" style={{ maxWidth:440 }} onClick={(e) => e.stopPropagation()}>
            <div className="pm-modal-head">
              <div className="pm-modal-title">My Profile</div>
              <X size={18} style={{ cursor:"pointer", color:"var(--muted)" }} onClick={() => setShowProfile(false)} />
            </div>
            <div className="pm-modal-body">
              {/* Tab bar */}
              <div style={{ display:"flex", gap:4, marginBottom:20, background:"var(--paper-deep)", borderRadius:10, padding:4 }}>
                {[["avatar","🖼 Photo"],["password","🔒 Password"],["theme","🎨 Theme"],["deactivate","⚠ Deactivate"]].map(([tab,label]) => (
                  <button key={tab} onClick={() => { setProfileTab(tab); setProfileMsg({ type:"", text:"" }); }}
                    style={{ flex:1, padding:"7px 0", fontSize:12, fontWeight:700, border:"none", borderRadius:7, cursor:"pointer",
                      background: profileTab===tab ? "#fff" : "transparent",
                      color: profileTab===tab ? "var(--teal-deep)" : "var(--muted)",
                      boxShadow: profileTab===tab ? "0 1px 4px rgba(11,79,108,0.12)" : "none",
                    }}>
                    {label}
                  </button>
                ))}
              </div>

              {profileMsg.text && (
                <div style={{ padding:"9px 12px", borderRadius:8, marginBottom:14, fontSize:12.5,
                  background: profileMsg.type==="ok" ? "#D1FAE5" : "#FEE2E2",
                  color: profileMsg.type==="ok" ? "#065F46" : "#991B1B",
                }}>
                  {profileMsg.text}
                </div>
              )}

              {profileTab === "avatar" && (
                <div style={{ textAlign:"center" }}>
                  <div style={{ margin:"0 auto 16px", width:90, height:90, borderRadius:"50%", overflow:"hidden", border:"3px solid var(--border)", background:"var(--paper-deep)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {avatarPreview
                      ? <img src={avatarPreview} alt="preview" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      : user.avatar_url
                        ? <img src={`${API_ORIGIN}${user.avatar_url}`} alt="avatar" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                        : <span style={{ fontSize:32, fontWeight:700, color:"var(--teal)" }}>{user.initials}</span>
                    }
                  </div>
                  <input ref={profileFileRef} type="file" accept="image/*" style={{ display:"none" }}
                    onChange={(e) => {
                      const f = e.target.files[0];
                      if (f) setAvatarPreview(URL.createObjectURL(f));
                    }} />
                  <button className="pm-btn-ghost" style={{ marginBottom:14 }} onClick={() => profileFileRef.current?.click()}>
                    Choose Photo
                  </button>
                  <div className="pm-modal-footer">
                    <button className="pm-btn-cancel" onClick={() => { setAvatarPreview(null); if(profileFileRef.current) profileFileRef.current.value=""; }}>Reset</button>
                    <button className="pm-btn-primary" disabled={!avatarPreview} onClick={async () => {
                      const f = profileFileRef.current?.files[0];
                      if (!f) return;
                      try {
                        const res = await api.uploadAvatar(token, f);
                        // Update local user display (parent holds user state via onAuthed)
                        user.avatar_url = res.avatar_url;
                        setAvatarPreview(null);
                        setProfileMsg({ type:"ok", text:"Profile photo updated!" });
                      } catch (err) { setProfileMsg({ type:"err", text: err.message }); }
                    }}>
                      Save Photo
                    </button>
                  </div>
                </div>
              )}

              {profileTab === "password" && (
                <div>
                  <div className="pm-field-row">
                    <label>Current Password</label>
                    <input type="password" value={profileCurrentPw} onChange={(e) => setProfileCurrentPw(e.target.value)} placeholder="Enter current password" />
                  </div>
                  <div className="pm-field-row">
                    <label>New Password</label>
                    <input type="password" value={profileNewPw} onChange={(e) => setProfileNewPw(e.target.value)} placeholder="Min 8 characters" />
                  </div>
                  <div className="pm-modal-footer">
                    <button className="pm-btn-cancel" onClick={() => { setProfileCurrentPw(""); setProfileNewPw(""); }}>Clear</button>
                    <button className="pm-btn-primary" disabled={!profileCurrentPw || profileNewPw.length < 8}
                      onClick={async () => {
                        try {
                          const res = await api.changePassword(token, profileCurrentPw, profileNewPw);
                          setProfileMsg({ type:"ok", text: res.message });
                          setProfileCurrentPw(""); setProfileNewPw("");
                        } catch (err) { setProfileMsg({ type:"err", text: err.message }); }
                      }}>
                      Update Password
                    </button>
                  </div>
                </div>
              )}

              {profileTab === "theme" && (
                <div>
                  <div style={{ fontSize:12.5, color:"var(--muted)", marginBottom:16, lineHeight:1.6 }}>
                    Choose how your dashboard looks. <strong>Default</strong> follows whatever
                    palette the Super Admin has set system-wide.
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    {THEME_ORDER.map((key) => {
                      const swatchVars = getThemeVars(key, systemTheme) || getThemeVars("blue", systemTheme);
                      const isActive = myTheme === key;
                      return (
                        <div
                          key={key}
                          onClick={async () => {
                            setMyTheme(key);
                            user.theme = key;
                            try {
                              await api.updateMyTheme(token, key);
                              setProfileMsg({ type:"ok", text:`Theme set to ${THEME_LABELS[key]}.` });
                            } catch (err) { setProfileMsg({ type:"err", text: err.message }); }
                          }}
                          style={{
                            cursor:"pointer", borderRadius:10, padding:"10px 12px",
                            border: isActive ? "2px solid var(--teal)" : "1.5px solid var(--border)",
                            background: swatchVars ? swatchVars["--paper"] : "#fff",
                          }}
                        >
                          <div style={{ display:"flex", gap:5, marginBottom:8 }}>
                            <div style={{ width:16, height:16, borderRadius:"50%", background: swatchVars ? swatchVars["--teal"] : "#1A7FA8" }} />
                            <div style={{ width:16, height:16, borderRadius:"50%", background: swatchVars ? swatchVars["--teal-deep"] : "#0B4F6C" }} />
                            <div style={{ width:16, height:16, borderRadius:"50%", border:"1px solid rgba(0,0,0,0.1)", background: swatchVars ? swatchVars["--card"] : "#fff" }} />
                          </div>
                          <div style={{ fontSize:12.5, fontWeight:700, color: swatchVars ? swatchVars["--ink"] : "#0B2233" }}>
                            {THEME_LABELS[key]}
                            {isActive && <Check size={12} style={{ marginLeft:6, verticalAlign:"middle", color:"var(--teal)" }} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {profileTab === "deactivate" && (
                <div style={{ textAlign:"center", padding:"10px 0" }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>⚠️</div>
                  <div style={{ fontSize:15, fontWeight:700, color:"#991B1B", marginBottom:8 }}>Deactivate Account</div>
                  <div style={{ fontSize:13, color:"var(--muted)", marginBottom:20, lineHeight:1.6 }}>
                    This will disable your account immediately. You will be signed out and will not be able to log in until an administrator reactivates your account.
                  </div>
                  <button
                    style={{ background:"#EF4444", color:"#fff", border:"none", borderRadius:9, padding:"11px 28px", fontSize:14, fontWeight:700, cursor:"pointer" }}
                    onClick={async () => {
                      if (!window.confirm("Are you sure you want to deactivate your account? You will be signed out.")) return;
                      try {
                        await api.deactivateAccount(token);
                        onLogout();
                      } catch (err) { setProfileMsg({ type:"err", text: err.message }); }
                    }}>
                    Deactivate My Account
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showRenameProject && activeProject && (
        <div className="pm-modal-overlay" onClick={() => setShowRenameProject(false)}>
          <div className="pm-modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="pm-modal-head">
              <div className="pm-modal-title">Rename Project</div>
              <X size={18} style={{ cursor:"pointer", color:"var(--muted)" }} onClick={() => setShowRenameProject(false)} />
            </div>
            <div className="pm-modal-body">
              <div className="pm-field-row">
                <label>Project Name</label>
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitRenameProject()}
                />
              </div>
              <div className="pm-modal-footer">
                <button className="pm-btn-cancel" onClick={() => setShowRenameProject(false)}>Cancel</button>
                <button className="pm-btn-primary" onClick={submitRenameProject} disabled={!renameValue.trim()}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -- Project Report Modal -- */}
      {showReport && (
        <div className="pm-modal-overlay" onClick={() => setShowReport(false)}>
          <div className="pm-modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="pm-modal-head">
              <div className="pm-modal-title">Project Report</div>
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                {reportData && (
                  <button className="pm-btn-ghost" style={{ padding:"6px 12px" }} onClick={() => window.print()}>
                    {"Print / Save as PDF"}
                  </button>
                )}
                <X size={18} style={{ cursor:"pointer", color:"var(--muted)" }} onClick={() => setShowReport(false)} />
              </div>
            </div>
            <div className="pm-modal-body" id="pm-report-printable">
              {reportLoading && <div style={{ textAlign:"center", padding:40, color:"var(--muted)" }}>Generating report…</div>}
              {reportData && (
                <>
                  <style>{`
                    @media print {
                      body * { visibility: hidden; }
                      #pm-report-printable, #pm-report-printable * { visibility: visible; }
                      #pm-report-printable { position: absolute; left: 0; top: 0; width: 100%; }
                    }
                  `}</style>
                  <h2 style={{ fontFamily:"'Merriweather',serif", fontSize:22, color:"var(--teal-deep)", marginBottom:2 }}>{reportData.project.name}</h2>
                  <div style={{ fontSize:11.5, color:"var(--muted)", marginBottom:18 }}>
                    Generated {new Date(reportData.generatedAt).toLocaleString()} · Created {new Date(reportData.project.created_at).toLocaleDateString()}
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:10, marginBottom:22 }}>
                    {[
                      ["Total Tasks", reportData.summary.totalTasks],
                      ["Overdue", reportData.summary.overdueCount],
                      ["Members", reportData.summary.memberCount],
                      ["Comments", reportData.summary.commentCount],
                    ].map(([label, val]) => (
                      <div key={label} style={{ background:"var(--paper-deep)", borderRadius:10, padding:"12px 14px", textAlign:"center" }}>
                        <div style={{ fontSize:22, fontWeight:800, color:"var(--teal-deep)" }}>{val}</div>
                        <div style={{ fontSize:10.5, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.04em", marginTop:2 }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  <h3 style={{ fontSize:13.5, fontWeight:700, marginBottom:8, color:"var(--teal-deep)" }}>Status Breakdown</h3>
                  <div style={{ display:"flex", gap:8, marginBottom:18, flexWrap:"wrap" }}>
                    {Object.entries(reportData.summary.byStatus).map(([s, n]) => (
                      <span key={s} style={{ background:STATUS_COLORS[s] || "#999", color:"#fff", borderRadius:999, padding:"4px 12px", fontSize:12, fontWeight:700 }}>
                        {STATUS_LABELS[s] || s}: {n}
                      </span>
                    ))}
                  </div>

                  <h3 style={{ fontSize:13.5, fontWeight:700, marginBottom:8, color:"var(--teal-deep)" }}>Workload by Assignee</h3>
                  <div style={{ marginBottom:18 }}>
                    {Object.entries(reportData.summary.byAssignee).map(([name, n]) => (
                      <div key={name} style={{ display:"flex", justifyContent:"space-between", fontSize:12.5, padding:"5px 0", borderBottom:"1px solid var(--border)" }}>
                        <span>{name}</span><span style={{ fontWeight:700 }}>{n} task{n!==1?"s":""}</span>
                      </div>
                    ))}
                  </div>

                  <h3 style={{ fontSize:13.5, fontWeight:700, marginBottom:8, color:"var(--teal-deep)" }}>Team & Members</h3>
                  <div style={{ fontSize:12.5, marginBottom:18 }}>
                    {reportData.members.map((m) => (
                      <div key={m.id} style={{ padding:"4px 0" }}>{m.name} — <span style={{ color:"var(--muted)" }}>{m.role}</span></div>
                    ))}
                  </div>

                  <h3 style={{ fontSize:13.5, fontWeight:700, marginBottom:8, color:"var(--teal-deep)" }}>Recent Activity</h3>
                  <div style={{ fontSize:12, maxHeight:240, overflowY:"auto" }}>
                    {reportData.recentActivity.map((a, i) => (
                      <div key={i} style={{ padding:"6px 0", borderBottom:"1px solid #F1EDE2" }}>
                        <strong>{a.task_title}</strong> — {a.detail}
                        <div style={{ color:"var(--muted)", fontSize:10.5 }}>{a.actor_name || "System"} · {new Date(a.created_at).toLocaleString()}</div>
                      </div>
                    ))}
                    {reportData.recentActivity.length === 0 && <div style={{ color:"var(--muted)" }}>No activity recorded yet.</div>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showArchived && (
        <div className="pm-overlay" onClick={() => setShowArchived(false)}>
          <div className="pm-panel" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="pm-panel-head">
              <span className="pm-serif" style={{ fontSize: 17, fontWeight: 600 }}>Archived Projects</span>
              <X size={18} className="pm-panel-close" onClick={() => setShowArchived(false)} />
            </div>
            {archivedProjects.length === 0 && (
              <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 10 }}>No archived projects yet.</div>
            )}
            {archivedProjects.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <span className="pm-proj-dot" style={{ background: "#8B8680", width: 8, height: 8, borderRadius: "50%", flexShrink: 0 }} />
                <span style={{ flex: 1, fontWeight: 600, fontSize: 13.5 }}>{p.name}</span>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{p.task_count} tasks</span>
                <button className="pm-btn-primary" style={{ padding: "5px 10px", fontSize: 11.5, background: "#3F7D52" }}
                  onClick={() => { archiveProject(p.id, false); }}>
                  Restore
                </button>
                {p.my_role === "owner" && (
                  <Trash2 size={14} style={{ cursor: "pointer", color: "#9C4221" }}
                    onClick={() => { if (window.confirm(`Permanently delete "${p.name}" and all its tasks?`)) { api.deleteProject(token, p.id).then(() => setArchivedProjects((prev) => prev.filter((x) => x.id !== p.id))).catch((e) => setError(e.message)); } }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showMembersPanel && activeProject && (
        <MembersPanel
          token={token}
          project={activeProject}
          members={members}
          currentUser={user}
          onMembersChanged={refreshMembers}
          onClose={() => setShowMembersPanel(false)}
        />
      )}

      {showTeamsPanel && activeProject && (
        <TeamsPanel
          token={token}
          project={activeProject}
          members={members}
          teams={teams}
          onTeamsChanged={refreshTeams}
          onClose={() => setShowTeamsPanel(false)}
        />
      )}

      {showAdminPanel && user.is_super_admin && (
        <AdminPanel
          token={token}
          currentUser={user}
          systemTheme={systemTheme}
          onSystemThemeChanged={setSystemTheme}
          onClose={() => setShowAdminPanel(false)}
        />
      )}

      {selectedTask && (
        <div className="pm-overlay" onClick={() => setSelectedTask(null)}>
          <div className="pm-panel" onClick={(e) => e.stopPropagation()}>
            <div className="pm-panel-head">
              <span className="pm-mono" style={{ fontSize: 11, color: "var(--muted)" }}>TASK-{selectedTask.id}</span>
              <X size={18} className="pm-panel-close" onClick={() => setSelectedTask(null)} />
            </div>
            <textarea
              className="pm-panel-title"
              rows={2}
              value={editTitle !== null ? editTitle : selectedTask.title}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => saveTaskText(selectedTask.id)}
              readOnly={isViewer}
            />
            {!isViewer && editTitle !== null && editTitle !== selectedTask.title && (
              <div className="pm-save-row">
                <button className="pm-btn-primary" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => saveTaskText(selectedTask.id)}>Save title</button>
              </div>
            )}

            <div className="pm-field-label">Description</div>
            <textarea
              className="pm-textarea"
              value={editDesc !== null ? editDesc : (selectedTask.description || "")}
              placeholder="Add a description…"
              onChange={(e) => setEditDesc(e.target.value)}
              onBlur={() => saveTaskText(selectedTask.id)}
              readOnly={isViewer}
            />
            {!isViewer && editDesc !== null && editDesc !== (selectedTask.description || "") && (
              <div className="pm-save-row">
                <button className="pm-btn-primary" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => saveTaskText(selectedTask.id)}>Save description</button>
              </div>
            )}

            <div className="pm-field-label">Subtasks ({subtasks.filter((s) => s.is_done).length}/{subtasks.length})</div>
            <div className="pm-subtasks-wrap">
              {subtasks.map((s) => (
                <div
                  className="pm-subtask-row"
                  key={s.id}
                  draggable={!isViewer}
                  onDragStart={() => handleSubtaskDragStart(s.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => !isViewer && handleSubtaskDrop(s.id)}
                  style={{ cursor: isViewer ? "default" : "grab", alignItems:"flex-start" }}
                >
                  <span style={{ color:"var(--muted)", fontSize:10, marginRight:2, cursor: isViewer ? "default" : "grab", marginTop:2 }}>⠿</span>
                  <span className={`pm-subtask-check ${s.is_done ? "done" : ""}`} style={{ marginTop:2 }} onClick={() => !isViewer && toggleSubtask(s.id, !s.is_done)}>
                    {s.is_done ? <CheckSquare size={16} /> : <Square size={16} />}
                  </span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className={`pm-subtask-title ${s.is_done ? "done" : ""}`}>{s.title}</div>
                    {s.target_at && !s.is_done && (
                      <div className="pm-subtask-meta">
                        🎯 {new Date(s.target_at).toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}
                      </div>
                    )}
                    {s.is_done && s.target_at && (
                      <div className="pm-subtask-meta completed">
                        ✓ Completed {new Date(s.target_at).toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}
                      </div>
                    )}
                  </div>
                  {!isViewer && (
                    <>
                      <span
                        title="Edit subtask"
                        style={{ cursor:"pointer", color:"var(--muted)", opacity:0, transition:"opacity .15s", fontSize:11, marginTop:2 }}
                        className="pm-subtask-edit-btn"
                        onClick={() => setEditingSubtask({ id: s.id, title: s.title, target_at: s.target_at ? toLocalInputValue(s.target_at) : "" })}
                      >
                        ✎
                      </span>
                      <X size={13} className="pm-subtask-del" style={{ marginTop:2 }} onClick={() => deleteSubtask(s.id)} />
                    </>
                  )}
                </div>
              ))}
              {!isViewer && (
                <div className="pm-subtask-add" style={{ flexDirection:"column", alignItems:"stretch", gap:6 }}>
                  <input
                    placeholder="Add a subtask…"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSubtask()}
                  />
                  <div style={{ display:"flex", gap:6 }}>
                    <input
                      type="datetime-local"
                      value={newSubtaskTarget}
                      onChange={(e) => setNewSubtaskTarget(e.target.value)}
                      style={{ flex:1, border:"1px dashed var(--border)", borderRadius:7, padding:"5px 8px", fontSize:11.5, outline:"none" }}
                      title="Target completion date/time (optional)"
                    />
                    <button className="pm-btn-primary" style={{ padding:"5px 12px", fontSize:11.5 }} onClick={addSubtask}>Add</button>
                  </div>
                </div>
              )}
            </div>

            <div className="pm-field-label">Status</div>
            <select className="pm-select" value={selectedTask.status} disabled={isViewer} onChange={(e) => requestStatusChange(selectedTask.id, e.target.value, selectedTask.title)}>
              {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>

            <div className="pm-field-label">Priority</div>
            <select className="pm-select" value={selectedTask.priority} disabled={isViewer} onChange={(e) => patchTask(selectedTask.id, { priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>

            <div className="pm-field-label">Category</div>
            <select className="pm-select" value={selectedTask.category || "simple"} disabled={isViewer} onChange={(e) => patchTask(selectedTask.id, { category: e.target.value })}>
              <option value="simple">Simple</option>
              <option value="complex">Complex</option>
            </select>

            <div className="pm-field-label">Assignee</div>
            <select
              className="pm-select"
              value={selectedTask.assignee_team_id ? `team-${selectedTask.assignee_team_id}` : selectedTask.assignee_id ? `user-${selectedTask.assignee_id}` : ""}
              disabled={isViewer}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) patchTask(selectedTask.id, { assigneeId: null, assigneeTeamId: null });
                else if (val.startsWith("team-")) patchTask(selectedTask.id, { assigneeTeamId: Number(val.slice(5)) });
                else patchTask(selectedTask.id, { assigneeId: Number(val.slice(5)) });
              }}
            >
              <option value="">Unassigned</option>
              {members.length > 0 && (
                <optgroup label="People">
                  {members.map((m) => <option key={`u${m.id}`} value={`user-${m.id}`}>{m.name}</option>)}
                </optgroup>
              )}
              {teams.length > 0 && (
                <optgroup label="Teams">
                  {teams.map((t) => <option key={`t${t.id}`} value={`team-${t.id}`}>{t.name} ({t.members.length})</option>)}
                </optgroup>
              )}
            </select>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <div className="pm-field-label">Start date</div>
                <input type="date" className="pm-dateinput" disabled={isViewer} value={selectedTask.start_date ? selectedTask.start_date.slice(0, 10) : ""} onChange={(e) => patchTask(selectedTask.id, { startDate: e.target.value })} />
              </div>
              <div>
                <div className="pm-field-label">Due date</div>
                <input type="date" className="pm-dateinput" disabled={isViewer} value={selectedTask.due_date ? selectedTask.due_date.slice(0, 10) : ""} onChange={(e) => patchTask(selectedTask.id, { dueDate: e.target.value })} />
              </div>
            </div>

            <div className="pm-field-label">Attachments</div>
            {attachments.map((a) => (
              <div className="pm-attachment" key={a.id} style={{ flexDirection:"column", alignItems:"flex-start", gap:2 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%" }}>
                  <a href={`${API_ORIGIN}${a.url}`} target="_blank" rel="noreferrer" className="pm-attachment-link">
                    <Paperclip size={12} /> {a.filename}
                  </a>
                  {!isViewer && <Trash2 size={13} className="pm-attachment-del" onClick={() => removeAttachment(a.id)} />}
                </div>
                <div style={{ fontSize:10.5, color:"var(--muted)", paddingLeft:18 }}>
                  {a.uploaded_by_name ? `${a.uploaded_by_name} · ` : ""}
                  {a.created_at ? new Date(a.created_at).toLocaleString([], { month:"short", day:"numeric", year:"numeric", hour:"2-digit", minute:"2-digit" }) : ""}
                </div>
              </div>
            ))}
            {!isViewer && (
              <>
                <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleFileSelected} />
                <div className="pm-btn-ghost" style={{ marginTop: 8, width: "fit-content" }} onClick={() => fileInputRef.current && fileInputRef.current.click()}>
                  <Upload size={13} /> {uploading ? "Uploading…" : "Upload file"}
                </div>
              </>
            )}

            <div className="pm-field-label" style={{ marginTop:14, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span>Links</span>
              {!isViewer && (
                <span
                  style={{ fontSize:11, color:"var(--teal)", cursor:"pointer", fontWeight:600 }}
                  onClick={() => setShowAddLink((v) => !v)}
                >
                  {showAddLink ? "Cancel" : "+ Add link"}
                </span>
              )}
            </div>
            {!isViewer && showAddLink && (
              <div style={{ background:"var(--paper-deep)", borderRadius:9, padding:"10px 12px", marginBottom:8 }}>
                <input
                  placeholder="Link name (e.g. Google Drive folder)"
                  value={newLinkLabel}
                  onChange={(e) => setNewLinkLabel(e.target.value)}
                  style={{ width:"100%", border:"1.5px solid var(--border)", borderRadius:8, padding:"7px 10px", fontSize:12.5, outline:"none", fontFamily:"inherit", marginBottom:7 }}
                />
                <input
                  placeholder="URL (e.g. https://drive.google.com/…)"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && newLinkLabel.trim() && newLinkUrl.trim()) {
                      try {
                        const link = await api.addLink(token, selectedTask.id, newLinkLabel.trim(), newLinkUrl.trim());
                        setTaskLinks((prev) => [...prev, link]);
                        setNewLinkLabel(""); setNewLinkUrl(""); setShowAddLink(false);
                      } catch (err) { setError(err.message); }
                    }
                  }}
                  style={{ width:"100%", border:"1.5px solid var(--border)", borderRadius:8, padding:"7px 10px", fontSize:12.5, outline:"none", fontFamily:"inherit", marginBottom:7 }}
                />
                <button
                  className="pm-btn-primary"
                  style={{ padding:"6px 14px", fontSize:12.5 }}
                  onClick={async () => {
                    if (!newLinkLabel.trim() || !newLinkUrl.trim()) return;
                    try {
                      const link = await api.addLink(token, selectedTask.id, newLinkLabel.trim(), newLinkUrl.trim());
                      setTaskLinks((prev) => [...prev, link]);
                      setNewLinkLabel(""); setNewLinkUrl(""); setShowAddLink(false);
                    } catch (err) { setError(err.message); }
                  }}
                  disabled={!newLinkLabel.trim() || !newLinkUrl.trim()}
                >
                  Add Link
                </button>
              </div>
            )}
            {taskLinks.map((l) => (
              <div key={l.id} style={{ display:"flex", alignItems:"center", gap:7, marginBottom:6 }}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ flex:1, display:"flex", alignItems:"center", gap:6, padding:"6px 10px", background:"#EFF8FF", border:"1px solid #BFDBFE", borderRadius:8, fontSize:12.5, color:"#1D4ED8", fontWeight:600, textDecoration:"none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}
                >
                  🔗 {l.label}
                </a>
                {!isViewer && (
                  <Trash2
                    size={13}
                    style={{ cursor:"pointer", color:"var(--muted)", flexShrink:0 }}
                    onClick={async () => {
                      try { await api.deleteLink(token, l.id); setTaskLinks((prev) => prev.filter((x) => x.id !== l.id)); }
                      catch (err) { setError(err.message); }
                    }}
                  />
                )}
              </div>
            ))}

            <div className="pm-field-label" style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span>Activity {activityFeed.length > 0 && `(${activityFeed.length})`}</span>
              {activityFeed.length > ACTIVITY_PREVIEW && (
                <span
                  onClick={() => setShowAllActivity((v) => !v)}
                  style={{ fontSize: 11, color: "var(--teal)", cursor: "pointer", fontWeight: 600, textTransform: "none", letterSpacing: 0 }}
                >
                  {showAllActivity ? "Show less" : `Show all ${activityFeed.length}`}
                </span>
              )}
            </div>

            {activityFeed.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>No activity yet.</div>
            )}

            {!showAllActivity && activityFeed.length > ACTIVITY_PREVIEW && (
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4, fontStyle: "italic" }}>
                Showing the {ACTIVITY_PREVIEW} most recent updates.
              </div>
            )}

            {visibleActivity.map((item) =>
              item.kind === "history" ? (
                <div className="pm-activity-row" key={`h${item.id}`}>
                  <Clock size={11} className="pm-activity-icon" />
                  <div>
                    <span className="pm-activity-detail">{item.detail}</span>
                    <span className="pm-activity-time"> · {new Date(item.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ) : (
                <div className="pm-comment" key={`c${item.id}`}>
                  <div className="pm-comment-head">
                    <div className="pm-comment-avatar" style={{ background: item.author_color }}>{item.author_initials}</div>
                    <span className="pm-comment-name">{item.author_name}</span>
                    <span className="pm-comment-time">{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                  <div className="pm-comment-body">{item.body}</div>
                </div>
              )
            )}

            {activityFeed.length > ACTIVITY_PREVIEW && !showAllActivity && (
              <button
                onClick={() => setShowAllActivity(true)}
                style={{ marginTop: 6, width: "100%", background: "var(--paper-deep)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 0", fontSize: 12.5, color: "var(--teal)", fontWeight: 600, cursor: "pointer" }}
              >
                Show all {activityFeed.length} activity entries
              </button>
            )}

            {!isViewer && (
              <div className="pm-comment-add">
                <input placeholder="Write a comment…" value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && postComment()} />
                <button className="pm-btn-primary" onClick={postComment}>Post</button>
              </div>
            )}

            {!isViewer && (
              <div className="pm-delete-btn" onClick={() => deleteTask(selectedTask.id)}>
                <X size={13} /> Delete task
              </div>
            )}
          </div>
        </div>
      )}

      {/* -- Floating Chat Widget (always rendered as a launcher bubble; expands when open) -- */}
      {activeProject && (
        <ChatPanel
          token={token}
          project={activeProject}
          currentUser={user}
          members={members}
          tasks={tasks}
          messages={chatMessages}
          open={showChat}
          onToggleOpen={() => setShowChat((v) => !v)}
          readOnly={isViewer}
          onOpenTask={(taskId) => {
            const t = tasks.find((x) => x.id === taskId);
            if (t) { setSelectedTask(t); setShowChat(false); }
          }}
        />
      )}
    </div>
  );
}
