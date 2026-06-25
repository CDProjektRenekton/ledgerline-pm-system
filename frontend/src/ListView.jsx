import React from "react";
import { Calendar, MessageSquare, Users } from "lucide-react";

const STATUS_LABEL = { todo: "To Do", inprogress: "In Progress", review: "In Review", done: "Done" };
const PRIORITY_COLOR = { high: "#9C4221", medium: "#C9A227", low: "#5C7A89" };

function formatDue(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ListView({ tasks, onSelect }) {
  return (
    <div className="pm-listwrap">
      <style>{`
        .pm-listwrap { padding: 18px 28px 22px; overflow-y: auto; flex: 1; }
        .pm-table { width: 100%; border-collapse: collapse; background: var(--card); border-radius: 10px; overflow: hidden; border: 1px solid var(--border); }
        .pm-table th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); padding: 10px 14px; border-bottom: 1px solid var(--border); background: var(--paper-deep); }
        .pm-table td { padding: 11px 14px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: middle; }
        .pm-table tr:last-child td { border-bottom: none; }
        .pm-table tr { cursor: pointer; }
        .pm-table tr:hover td { background: #FBF9F3; }
        .pm-pill { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; color: #fff; display: inline-block; }
        .pm-pri-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
        .pm-table-avatar { width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-size: 9.5px; font-weight: 700; }
        .pm-list-team { display:inline-flex; align-items:center; gap:4px; padding: 3px 8px; border-radius: 999px; color:#fff; font-size: 10.5px; font-weight: 700; }
      `}</style>
      <table className="pm-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Assignee</th>
            <th>Start Date</th>
            <th>Due Date</th>
            <th>Comments</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} onClick={() => onSelect(t)}>
              <td style={{ fontWeight: 600 }}>{t.title}</td>
              <td>
                <span className="pm-pill" style={{ background: STATUS_COLOR[t.status] }}>
                  {STATUS_LABEL[t.status]}
                </span>
              </td>
              <td>
                <span className="pm-pri-dot" style={{ background: PRIORITY_COLOR[t.priority] }} />
                {t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}
              </td>
              <td>
                {t.assignee_team_id ? (
                  <span className="pm-list-team" style={{ background: t.team_color }}>
                    <Users size={10} /> {t.team_name}
                  </span>
                ) : t.assignee_initials ? (
                  <span className="pm-table-avatar" style={{ background: t.assignee_color }}>{t.assignee_initials}</span>
                ) : (
                  <span style={{ color: "var(--muted)" }}>Unassigned</span>
                )}
              </td>
              <td style={{ color: "var(--muted)" }}>
                {t.start_date ? <span style={{ display:"flex", alignItems:"center", gap:5, color:"#10B981" }}><Calendar size={12} /> {formatDue(t.start_date)}</span> : "—"}
              </td>
              <td style={{ color: "var(--muted)" }}>
                {t.due_date ? <span style={{ display:"flex", alignItems:"center", gap:5 }}><Calendar size={12} /> {formatDue(t.due_date)}</span> : "—"}
              </td>
              <td style={{ color: "var(--muted)" }}>
                {Number(t.comment_count) > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <MessageSquare size={12} /> {t.comment_count}
                  </span>
                )}
              </td>
            </tr>
          ))}
          {tasks.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 30 }}>
                No tasks yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const STATUS_COLOR = { todo: "#8B8680", inprogress: "#1F6F78", review: "#C9A227", done: "#3F7D52" };
