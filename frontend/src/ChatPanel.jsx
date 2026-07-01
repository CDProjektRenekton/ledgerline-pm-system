import React, { useEffect, useRef, useState } from "react";
import { X, Send, AtSign, Hash } from "lucide-react";
import { api } from "./api";

function timeAgo(dateStr) {
  const s = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function renderBody(body, currentUserId) {
  // Highlight @mentions and task references
  const parts = body.split(/(@\w[\w\s]*?\b|#[^\s]+)/g);
  return parts.map((p, i) => {
    if (p.startsWith("@")) return <strong key={i} style={{ color: "#1A7FA8" }}>{p}</strong>;
    if (p.startsWith("#")) return <span key={i} style={{ background: "#DBEAFE", color: "#1D4ED8", borderRadius: 4, padding: "1px 5px", fontSize: "11.5px", fontWeight: 600 }}>{p}</span>;
    return p;
  });
}

export default function ChatPanel({ token, project, currentUser, members, tasks, messages: initialMessages = [], open, onToggleOpen, onOpenTask }) {
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [selectedTaskRef, setSelectedTaskRef] = useState(null);
  const [mentionIds, setMentionIds] = useState([]);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [unseenCount, setUnseenCount] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Load history on open, then merge with any real-time messages that
  // arrived via socket and were stored in initialMessages.
  useEffect(() => {
    api.listMessages(token, project.id)
      .then((history) => {
        // Merge history with any real-time messages already in state
        const ids = new Set(history.map((m) => m.id));
        const extras = initialMessages.filter((m) => !ids.has(m.id));
        setMessages([...history, ...extras].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
      })
      .catch((e) => setError(e.message));
  }, [token, project.id]);

  // Accept new real-time messages pushed from Dashboard via initialMessages
  useEffect(() => {
    if (initialMessages.length === 0) return;
    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const extras = initialMessages.filter((m) => !ids.has(m.id));
      if (extras.length === 0) return prev;
      if (!open) {
        setUnseenCount((c) => c + extras.filter((m) => m.author_id !== currentUser.id).length);
      }
      return [...prev, ...extras].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    });
  }, [initialMessages]);

  // Clear the unseen badge whenever the panel is opened
  useEffect(() => {
    if (open) setUnseenCount(0);
  }, [open]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!body.trim() && !selectedTaskRef) return;
    setSending(true);
    try {
      const msg = await api.sendMessage(
        token, project.id,
        body.trim() || `Referenced: #${selectedTaskRef?.title}`,
        selectedTaskRef?.id,
        mentionIds
      );
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
      setBody(""); setSelectedTaskRef(null); setMentionIds([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const toggleMention = (uid) => {
    setMentionIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const addTaskRef = (task) => {
    setSelectedTaskRef(task);
    setShowTaskPicker(false);
    // append task reference to body
    setBody((b) => b + (b && !b.endsWith(" ") ? " " : "") + `#${task.title} `);
    inputRef.current?.focus();
  };

  const addMentionToBody = (member) => {
    setMentionIds((prev) => prev.includes(member.id) ? prev : [...prev, member.id]);
    setBody((b) => {
      const atIdx = b.lastIndexOf("@");
      const before = atIdx >= 0 ? b.slice(0, atIdx) : b;
      return before + `@${member.name.split(" ")[0]} `;
    });
    setShowMentionPicker(false);
    setMentionQuery("");
    inputRef.current?.focus();
  };

  const handleBodyChange = (e) => {
    const val = e.target.value;
    setBody(val);
    // Auto-trigger @mention picker when user types @
    const atMatch = val.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1].toLowerCase());
      setShowMentionPicker(true);
    } else {
      setShowMentionPicker(false);
      setMentionQuery("");
    }
  };

  const filteredMembers = members.filter((m) =>
    m.name.toLowerCase().includes(mentionQuery) && m.id !== currentUser.id
  );

  return (
    <div className="chat-float-wrap">
      <style>{`
        /* z-index 45 — intentionally BELOW the task-detail overlay (z-index 50) and
           modals (100+), so the floating chat is automatically covered/hidden
           by the dim scrim whenever a side panel or modal is open. */
        .chat-float-wrap { position: fixed; bottom: 22px; right: 22px; z-index: 45; display:flex; flex-direction:column; align-items:flex-end; }
        .chat-launcher { width:56px; height:56px; border-radius:50%; background:linear-gradient(135deg,#1A7FA8,#0B4F6C); display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 6px 20px rgba(11,79,108,0.35); color:#fff; position:relative; transition:transform .15s; }
        .chat-launcher:hover { transform: scale(1.06); }
        .chat-launcher-badge { position:absolute; top:-4px; right:-4px; background:#EF4444; color:#fff; font-size:10px; font-weight:800; border-radius:999px; min-width:20px; height:20px; display:flex; align-items:center; justify-content:center; padding:0 4px; border:2px solid #fff; }
        .chat-panel { display:flex; flex-direction:column; width:360px; height:520px; max-height:75vh; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 16px 48px rgba(11,79,108,0.28); margin-bottom:14px; border:1px solid var(--border); }
        .chat-head { padding:13px 14px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(135deg,#0B4F6C,#1A7FA8); flex-shrink:0; }
        .chat-head-title { font-size:13.5px; font-weight:700; color:#fff; display:flex; align-items:center; gap:7px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .chat-head-actions { display:flex; align-items:center; gap:10px; flex-shrink:0; }
        .chat-messages { flex:1; overflow-y:auto; padding:12px 14px; display:flex; flex-direction:column; gap:10px; background:#F8FCFF; }
        .chat-bubble-wrap { display:flex; flex-direction:column; }
        .chat-bubble-wrap.mine { align-items:flex-end; }
        .chat-bubble-wrap.other { align-items:flex-start; }
        .chat-meta { display:flex; align-items:center; gap:6px; margin-bottom:3px; }
        .chat-meta.mine { flex-direction:row-reverse; }
        .chat-avatar { width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-size:9px; font-weight:700; flex-shrink:0; }
        .chat-author { font-size:11px; font-weight:600; color:var(--muted); }
        .chat-time { font-size:10px; color:#B0C8D8; }
        .chat-bubble { max-width:230px; padding:8px 12px; border-radius:14px; font-size:13px; line-height:1.45; word-break:break-word; }
        .chat-bubble.mine { background:linear-gradient(135deg,#1A7FA8,#0B4F6C); color:#fff; border-radius:14px 14px 4px 14px; }
        .chat-bubble.other { background:#fff; color:#0B2233; border:1px solid var(--border); border-radius:14px 14px 14px 4px; box-shadow:0 1px 3px rgba(11,79,108,0.07); }
        .chat-task-chip { display:inline-flex; align-items:center; gap:4px; background:rgba(255,255,255,0.2); border-radius:6px; padding:3px 8px; font-size:11px; font-weight:600; margin-bottom:5px; cursor:pointer; }
        .chat-bubble.other .chat-task-chip { background:#DBEAFE; color:#1D4ED8; }
        .chat-input-wrap { border-top:1px solid var(--border); padding:10px 12px; background:#fff; flex-shrink:0; }
        .chat-toolbar { display:flex; gap:6px; margin-bottom:7px; }
        .chat-tool-btn { display:flex; align-items:center; gap:4px; padding:4px 9px; border:1.5px solid var(--border); border-radius:7px; background:#fff; font-size:11.5px; color:var(--teal); cursor:pointer; font-weight:600; }
        .chat-tool-btn:hover { background:var(--paper-deep); }
        .chat-tool-btn.active { background:#DBEAFE; border-color:#93C5FD; color:#1D4ED8; }
        .chat-ref-chip { display:inline-flex; align-items:center; gap:5px; background:#DBEAFE; color:#1D4ED8; border-radius:6px; padding:3px 8px; font-size:11.5px; font-weight:600; margin-bottom:6px; }
        .chat-mention-chips { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:6px; }
        .chat-mention-chip { display:inline-flex; align-items:center; gap:4px; background:#EDE9FE; color:#5B21B6; border-radius:999px; padding:2px 8px; font-size:11px; font-weight:600; }
        .chat-row { display:flex; gap:7px; align-items:flex-end; }
        .chat-textarea { flex:1; border:1.5px solid var(--border); border-radius:10px; padding:8px 11px; font-size:13px; font-family:'Inter',sans-serif; resize:none; outline:none; min-height:38px; max-height:100px; transition:border-color .15s; }
        .chat-textarea:focus { border-color:var(--teal); }
        .chat-send-btn { width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,#1A7FA8,#0B4F6C); border:none; color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }
        .chat-send-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .chat-picker { position:absolute; bottom:100%; left:0; right:0; background:#fff; border:1px solid var(--border); border-radius:10px 10px 0 0; box-shadow:0 -4px 16px rgba(11,79,108,0.12); max-height:200px; overflow-y:auto; z-index:10; }
        .chat-picker-item { display:flex; align-items:center; gap:8px; padding:9px 12px; cursor:pointer; font-size:13px; }
        .chat-picker-item:hover { background:var(--paper-deep); }
        .chat-picker-label { font-size:11px; text-transform:uppercase; color:var(--muted); padding:6px 12px 3px; font-weight:600; letter-spacing:.06em; }
        .chat-empty { text-align:center; color:var(--muted); font-size:13px; padding:40px 16px; }
        .chat-error { font-size:12px; color:#DC2626; padding:6px 14px; }
      `}</style>

      {open && (
        <div className="chat-panel">
          <div className="chat-head">
            <div className="chat-head-title">
              <span style={{ fontSize:16 }}>💬</span>
              {project.name}
            </div>
            <div className="chat-head-actions">
              <X size={16} style={{ cursor:"pointer", color:"rgba(255,255,255,0.75)" }} onClick={onToggleOpen} />
            </div>
          </div>

          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-empty">No messages yet. Start the conversation!</div>
            )}
            {messages.map((m) => {
              const isMine = m.author_id === currentUser.id;
              return (
                <div className={`chat-bubble-wrap ${isMine ? "mine" : "other"}`} key={m.id}>
                  <div className={`chat-meta ${isMine ? "mine" : "other"}`}>
                    <div className="chat-avatar" style={{ background: m.author_color || "#1A7FA8" }}>
                      {m.author_initials || m.author_name?.[0]}
                    </div>
                    <span className="chat-author">{isMine ? "You" : m.author_name}</span>
                    <span className="chat-time">{timeAgo(m.created_at)}</span>
                  </div>
                  <div className={`chat-bubble ${isMine ? "mine" : "other"}`}>
                    {m.task_ref_id && (
                      <div
                        className="chat-task-chip"
                        onClick={() => onOpenTask && onOpenTask(m.task_ref_id)}
                        title="Click to open task"
                      >
                        # {m.task_ref_title || `Task #${m.task_ref_id}`}
                      </div>
                    )}
                    <div>{renderBody(m.body, currentUser.id)}</div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {error && <div className="chat-error">{error}</div>}

          <div className="chat-input-wrap" style={{ position:"relative" }}>
            {showTaskPicker && (
              <div className="chat-picker">
                <div className="chat-picker-label">Select a task to reference</div>
                {tasks.slice(0, 20).map((t) => (
                  <div key={t.id} className="chat-picker-item" onClick={() => addTaskRef(t)}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background:"#1A7FA8", display:"inline-block" }} />
                    {t.title}
                  </div>
                ))}
              </div>
            )}
            {showMentionPicker && filteredMembers.length > 0 && (
              <div className="chat-picker">
                <div className="chat-picker-label">Mention a member</div>
                {filteredMembers.map((m) => (
                  <div key={m.id} className="chat-picker-item" onClick={() => addMentionToBody(m)}>
                    <div className="chat-avatar" style={{ background: m.color }}>{m.initials}</div>
                    {m.name}
                  </div>
                ))}
              </div>
            )}

            <div className="chat-toolbar">
              <button
                className={`chat-tool-btn ${showTaskPicker ? "active" : ""}`}
                onClick={() => { setShowTaskPicker((v) => !v); setShowMentionPicker(false); }}
              >
                <Hash size={13} /> Task
              </button>
              <button
                className={`chat-tool-btn ${showMentionPicker ? "active" : ""}`}
                onClick={() => { setShowMentionPicker((v) => !v); setShowTaskPicker(false); }}
              >
                <AtSign size={13} /> Mention
              </button>
            </div>

            {selectedTaskRef && (
              <div className="chat-ref-chip">
                # {selectedTaskRef.title}
                <X size={11} style={{ cursor:"pointer" }} onClick={() => setSelectedTaskRef(null)} />
              </div>
            )}
            {mentionIds.length > 0 && (
              <div className="chat-mention-chips">
                {mentionIds.map((uid) => {
                  const m = members.find((x) => x.id === uid);
                  return m ? (
                    <span key={uid} className="chat-mention-chip">
                      @{m.name.split(" ")[0]}
                      <X size={10} style={{ cursor:"pointer" }} onClick={() => toggleMention(uid)} />
                    </span>
                  ) : null;
                })}
              </div>
            )}

            <div className="chat-row">
              <textarea
                ref={inputRef}
                className="chat-textarea"
                placeholder="Write a message… (@ to mention)"
                value={body}
                onChange={handleBodyChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                rows={1}
              />
              <button className="chat-send-btn" onClick={send} disabled={sending || (!body.trim() && !selectedTaskRef)}>
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="chat-launcher" onClick={onToggleOpen} title={open ? "Close chat" : "Open project chat"}>
        {open ? <X size={22} /> : <span style={{ fontSize:24 }}>💬</span>}
        {!open && unseenCount > 0 && (
          <span className="chat-launcher-badge">{unseenCount > 9 ? "9+" : unseenCount}</span>
        )}
      </div>
    </div>
  );
}
