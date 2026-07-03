import React, { useEffect, useRef, useState } from "react";
import { Bell, Check, X, Trash2 } from "lucide-react";

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const TYPE_DOT = {
  assigned:      "#1A7FA8",
  status_change: "#F59E0B",
  due_soon:      "#F59E0B",
  overdue:       "#EF4444",
  mention:       "#8B5CF6",
  project_invite:"#10B981",
};

export default function NotificationBell({
  token,
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  onClearAll,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="pm-bell-wrap" ref={ref}>
      <style>{`
        .pm-bell-wrap { position: relative; }
        .pm-bell-btn { position: relative; width: 32px; height: 32px; border-radius: 8px;
          display:flex; align-items:center; justify-content:center; cursor:pointer;
          border: 1px solid var(--border); background: var(--card); color: var(--ink); }
        .pm-bell-btn:hover { background: var(--paper-deep); }
        .pm-bell-badge { position:absolute; top:-5px; right:-5px; background:#EF4444; color:#fff;
          font-size:9px; font-weight:800; border-radius:999px; min-width:16px; height:16px;
          display:flex; align-items:center; justify-content:center; padding:0 3px; border:2px solid #fff; }
        .pm-bell-dropdown { position:absolute; top:40px; right:0; width:340px; max-height:440px;
          overflow-y:auto; background:var(--card); border:1px solid var(--border);
          border-radius:14px; box-shadow:0 8px 32px rgba(11,79,108,0.16); z-index:60; }
        .pm-bell-head { display:flex; justify-content:space-between; align-items:center;
          padding:12px 14px 10px; border-bottom:1px solid var(--border); flex-shrink:0; position:sticky; top:0; background:var(--card); z-index:1; }
        .pm-bell-title { font-size:13.5px; font-weight:700; color:var(--teal-deep); }
        .pm-bell-actions { display:flex; align-items:center; gap:10px; }
        .pm-bell-action-btn { font-size:11px; color:var(--teal); cursor:pointer;
          display:flex; align-items:center; gap:3px; font-weight:600; white-space:nowrap; }
        .pm-bell-action-btn:hover { text-decoration:underline; }
        .pm-bell-action-btn.danger { color:#EF4444; }
        .pm-bell-item { display:flex; align-items:flex-start; gap:9px; padding:10px 12px;
          border-bottom:1px solid var(--border); position:relative; }
        .pm-bell-item:last-child { border-bottom:none; }
        .pm-bell-item.unread { background:#F0F8FF; }
        .pm-bell-item:hover { background:#EEF6FC; }
        .pm-bell-dot { width:8px; height:8px; border-radius:50%; margin-top:4px; flex-shrink:0; }
        .pm-bell-content { flex:1; min-width:0; cursor:pointer; }
        .pm-bell-msg { font-size:12.5px; line-height:1.4; color:var(--ink); }
        .pm-bell-time { font-size:10.5px; color:var(--muted); margin-top:2px; }
        .pm-bell-dismiss { opacity:0; cursor:pointer; color:var(--muted); flex-shrink:0;
          padding:2px; border-radius:5px; transition:opacity .12s, color .12s; }
        .pm-bell-item:hover .pm-bell-dismiss { opacity:1; }
        .pm-bell-dismiss:hover { color:#EF4444; background:#FEE2E2; }
        .pm-bell-empty { padding:32px 14px; text-align:center; color:var(--muted); font-size:13px; }
        .pm-bell-empty-icon { font-size:28px; margin-bottom:8px; }
      `}</style>

      <div className="pm-bell-btn" onClick={() => setOpen((o) => !o)}>
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="pm-bell-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </div>

      {open && (
        <div className="pm-bell-dropdown">
          <div className="pm-bell-head">
            <span className="pm-bell-title">
              Notifications
              {unreadCount > 0 && (
                <span style={{ marginLeft:7, fontSize:10, background:"#EF4444", color:"#fff", borderRadius:999, padding:"1px 6px", fontWeight:800 }}>
                  {unreadCount}
                </span>
              )}
            </span>
            <div className="pm-bell-actions">
              {unreadCount > 0 && (
                <span className="pm-bell-action-btn" onClick={onMarkAllRead}>
                  <Check size={11} /> Mark all read
                </span>
              )}
              {notifications.length > 0 && (
                <span
                  className="pm-bell-action-btn danger"
                  onClick={() => { if (window.confirm("Clear all notifications? This can't be undone.")) onClearAll(); }}
                >
                  <Trash2 size={11} /> Clear all
                </span>
              )}
            </div>
          </div>

          {notifications.length === 0 && (
            <div className="pm-bell-empty">
              <div className="pm-bell-empty-icon">🔔</div>
              You're all caught up!
            </div>
          )}

          {notifications.map((n) => (
            <div
              key={n.id}
              className={`pm-bell-item ${n.is_read ? "" : "unread"}`}
            >
              <span
                className="pm-bell-dot"
                style={{ background: TYPE_DOT[n.type] || "#8B8680" }}
              />
              <div
                className="pm-bell-content"
                onClick={() => { if (!n.is_read) onMarkRead(n.id); }}
              >
                <div className="pm-bell-msg">{n.message}</div>
                <div className="pm-bell-time">{timeAgo(n.created_at)}</div>
              </div>
              <span
                className="pm-bell-dismiss"
                title="Dismiss"
                onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}
              >
                <X size={13} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
