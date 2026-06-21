import React, { useEffect, useRef, useState } from "react";
import { Bell, Check } from "lucide-react";
import { api } from "./api";

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const TYPE_DOT = { assigned: "#1F6F78", status_change: "#C9A227", due_soon: "#C9A227", overdue: "#9C4221" };

export default function NotificationBell({ token, notifications, unreadCount, onMarkRead, onMarkAllRead }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="pm-bell-wrap" ref={ref}>
      <style>{`
        .pm-bell-wrap { position: relative; }
        .pm-bell-btn { position: relative; width: 32px; height: 32px; border-radius: 8px; display:flex; align-items:center; justify-content:center; cursor:pointer; border: 1px solid var(--border); background: var(--card); color: var(--ink); }
        .pm-bell-badge { position:absolute; top:-4px; right:-4px; background:#9C4221; color:#fff; font-size:9.5px; font-weight:700; border-radius:999px; min-width:16px; height:16px; display:flex; align-items:center; justify-content:center; padding:0 3px; }
        .pm-bell-dropdown { position:absolute; top: 40px; right: 0; width: 320px; max-height: 380px; overflow-y:auto; background: var(--card); border:1px solid var(--border); border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); z-index: 60; }
        .pm-bell-head { display:flex; justify-content:space-between; align-items:center; padding: 12px 14px; border-bottom: 1px solid var(--border); }
        .pm-bell-title { font-size: 13px; font-weight: 700; }
        .pm-bell-markall { font-size: 11px; color: var(--teal); cursor:pointer; display:flex; align-items:center; gap:4px; }
        .pm-bell-item { display:flex; gap:9px; padding: 10px 14px; border-bottom: 1px solid #F1EDE2; cursor:pointer; }
        .pm-bell-item:last-child { border-bottom: none; }
        .pm-bell-item.unread { background: #FBF8F1; }
        .pm-bell-item:hover { background: #F6F2E9; }
        .pm-bell-dot { width: 7px; height: 7px; border-radius: 50%; margin-top: 5px; flex-shrink:0; }
        .pm-bell-msg { font-size: 12.5px; line-height: 1.4; }
        .pm-bell-time { font-size: 10.5px; color: var(--muted); margin-top: 2px; }
        .pm-bell-empty { padding: 30px 14px; text-align:center; color: var(--muted); font-size: 12.5px; }
      `}</style>

      <div className="pm-bell-btn" onClick={() => setOpen((o) => !o)}>
        <Bell size={15} />
        {unreadCount > 0 && <span className="pm-bell-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </div>

      {open && (
        <div className="pm-bell-dropdown">
          <div className="pm-bell-head">
            <span className="pm-bell-title">Notifications</span>
            {unreadCount > 0 && (
              <span className="pm-bell-markall" onClick={onMarkAllRead}>
                <Check size={12} /> Mark all read
              </span>
            )}
          </div>
          {notifications.length === 0 && <div className="pm-bell-empty">You're all caught up.</div>}
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`pm-bell-item ${n.is_read ? "" : "unread"}`}
              onClick={() => !n.is_read && onMarkRead(n.id)}
            >
              <span className="pm-bell-dot" style={{ background: TYPE_DOT[n.type] || "#8B8680" }} />
              <div>
                <div className="pm-bell-msg">{n.message}</div>
                <div className="pm-bell-time">{timeAgo(n.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
