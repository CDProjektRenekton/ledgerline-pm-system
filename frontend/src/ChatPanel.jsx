import React, { useEffect, useRef, useState } from "react";
import { X, Send, AtSign, Hash, Paperclip, Link, ChevronDown, ChevronUp } from "lucide-react";
import { api, API_ORIGIN } from "./api";

function timeAgo(dateStr) {
  const s = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function renderBody(body) {
  const parts = body.split(/(@\w[\w\s]*?\b|#[^\s]+)/g);
  return parts.map((p, i) => {
    if (p.startsWith("@")) return <strong key={i} style={{ color:"#1A7FA8" }}>{p}</strong>;
    if (p.startsWith("#")) return <span key={i} style={{ background:"#DBEAFE", color:"#1D4ED8", borderRadius:4, padding:"1px 5px", fontSize:"11.5px", fontWeight:600 }}>{p}</span>;
    return p;
  });
}

export default function ChatPanel({ token, project, currentUser, members, tasks, messages: initialMessages = [], open, onToggleOpen, onOpenTask, readOnly = false }) {
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
  // Attachment + link in chat
  const [attachFile, setAttachFile] = useState(null);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const chatFileRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    api.listMessages(token, project.id)
      .then((history) => {
        const ids = new Set(history.map((m) => m.id));
        const extras = initialMessages.filter((m) => !ids.has(m.id));
        setMessages([...history, ...extras].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
      })
      .catch((e) => setError(e.message));
  }, [token, project.id]);

  useEffect(() => {
    if (initialMessages.length === 0) return;
    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const extras = initialMessages.filter((m) => !ids.has(m.id));
      if (extras.length === 0) return prev;
      if (!open) setUnseenCount((c) => c + extras.filter((m) => m.author_id !== currentUser.id).length);
      return [...prev, ...extras].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    });
  }, [initialMessages]);

  useEffect(() => {
    if (open) setUnseenCount(0);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    let messageBody = body.trim();

    // If a link form is filled out, embed it in the message body
    if (showLinkForm && linkLabel.trim() && linkUrl.trim()) {
      const safeUrl = linkUrl.trim().startsWith("http") ? linkUrl.trim() : `https://${linkUrl.trim()}`;
      messageBody = (messageBody ? messageBody + "\n" : "") + `[${linkLabel.trim()}](${safeUrl})`;
      setLinkLabel(""); setLinkUrl(""); setShowLinkForm(false);
    }

    if (!messageBody && !attachFile && !selectedTaskRef) return;
    setSending(true);
    try {
      // Upload file first if one is attached
      let fileNote = "";
      if (attachFile) {
        const form = new FormData();
        form.append("file", attachFile);
        form.append("chatProjectId", project.id);
        // Just note the filename in the message body for now (full upload needs a chat-files endpoint)
        fileNote = `\n📎 ${attachFile.name}`;
        setAttachFile(null);
        if (chatFileRef.current) chatFileRef.current.value = "";
      }

      const finalBody = (messageBody || (selectedTaskRef ? `Referenced: #${selectedTaskRef.title}` : "")) + fileNote;
      const msg = await api.sendMessage(token, project.id, finalBody, selectedTaskRef?.id, mentionIds);
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
      setBody(""); setSelectedTaskRef(null); setMentionIds([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const toggleMention = (uid) => setMentionIds((prev) => prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]);

  const addTaskRef = (task) => {
    setSelectedTaskRef(task);
    setShowTaskPicker(false);
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
    const atMatch = val.match(/@(\w*)$/);
    if (atMatch) { setMentionQuery(atMatch[1].toLowerCase()); setShowMentionPicker(true); }
    else { setShowMentionPicker(false); setMentionQuery(""); }
  };

  const filteredMembers = members.filter((m) => m.name.toLowerCase().includes(mentionQuery) && m.id !== currentUser.id);

  // Parse embedded links from message body: [label](url) → clickable
  const renderMessageBody = (text) => {
    const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    const parts = [];
    let last = 0;
    let match;
    while ((match = linkPattern.exec(text)) !== null) {
      if (match.index > last) parts.push(renderBody(text.slice(last, match.index)));
      parts.push(
        <a key={match.index} href={match[2]} target="_blank" rel="noreferrer"
          style={{ display:"inline-flex", alignItems:"center", gap:4, background:"#DBEAFE", color:"#1D4ED8", borderRadius:6, padding:"2px 8px", fontSize:12, fontWeight:600, textDecoration:"none", margin:"1px 2px" }}>
          🔗 {match[1]}
        </a>
      );
      last = match.index + match[0].length;
    }
    if (last < text.length) parts.push(renderBody(text.slice(last)));
    return parts;
  };

  return (
    <div className="chat-float-wrap">
      <style>{`
        .chat-float-wrap { position:fixed; bottom:22px; right:22px; z-index:45; display:flex; flex-direction:column; align-items:flex-end; }
        .chat-launcher { width:56px; height:56px; border-radius:50%; background:linear-gradient(135deg,#1A7FA8,#0B4F6C); display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 6px 20px rgba(11,79,108,0.35); color:#fff; position:relative; transition:transform .15s; }
        .chat-launcher:hover { transform:scale(1.06); }
        .chat-launcher-badge { position:absolute; top:-4px; right:-4px; background:#EF4444; color:#fff; font-size:10px; font-weight:800; border-radius:999px; min-width:20px; height:20px; display:flex; align-items:center; justify-content:center; padding:0 4px; border:2px solid #fff; }

        /* Thread-style panel */
        .chat-panel { display:flex; flex-direction:column; width:380px; height:560px; max-height:78vh; background:#fff; border-radius:18px; overflow:hidden; box-shadow:0 16px 48px rgba(11,79,108,0.22); margin-bottom:14px; border:1px solid #C5DFF0; }
        .chat-head { padding:14px 16px 12px; display:flex; align-items:center; justify-content:space-between; background:linear-gradient(135deg,#0B4F6C,#1A7FA8); flex-shrink:0; }
        .chat-head-title { font-size:14px; font-weight:700; color:#fff; display:flex; align-items:center; gap:8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .chat-head-sub { font-size:10.5px; color:rgba(255,255,255,0.6); margin-top:1px; }

        /* Thread messages */
        .chat-thread { flex:1; overflow-y:auto; padding:12px 14px; display:flex; flex-direction:column; gap:0; background:#F8FCFF; }
        .chat-thread-msg { display:flex; gap:9px; padding:8px 0; position:relative; }
        .chat-thread-msg:not(:last-child)::after { content:''; position:absolute; left:16px; top:38px; bottom:0; width:2px; background:#E8F0F8; }
        .chat-thread-avatar { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px; font-weight:700; flex-shrink:0; z-index:1; border:2px solid #fff; box-shadow:0 1px 4px rgba(11,79,108,0.15); }
        .chat-thread-body { flex:1; min-width:0; }
        .chat-thread-meta { display:flex; align-items:baseline; gap:7px; margin-bottom:4px; }
        .chat-thread-name { font-size:13px; font-weight:700; color:#0B2233; }
        .chat-thread-time { font-size:10.5px; color:#9BBDD4; }
        .chat-thread-text { font-size:13px; color:#1B2A35; line-height:1.5; word-break:break-word; background:#fff; border:1px solid #E8F4FB; border-radius:0 12px 12px 12px; padding:8px 12px; display:inline-block; max-width:100%; box-shadow:0 1px 3px rgba(11,79,108,0.06); }
        .chat-thread-msg.mine .chat-thread-text { background:linear-gradient(135deg,#1A7FA8,#0B4F6C); color:#fff; border-color:transparent; border-radius:12px 0 12px 12px; }
        .chat-thread-msg.mine { flex-direction:row-reverse; }
        .chat-thread-msg.mine .chat-thread-meta { flex-direction:row-reverse; }
        .chat-thread-msg.mine::after { left:auto; right:16px; }
        .chat-task-chip { display:inline-flex; align-items:center; gap:4px; background:rgba(255,255,255,0.2); border-radius:6px; padding:3px 8px; font-size:11px; font-weight:600; margin-bottom:5px; cursor:pointer; border:1px solid rgba(255,255,255,0.3); }
        .chat-task-chip.other { background:#DBEAFE; color:#1D4ED8; border-color:#BFDBFE; }

        /* Input area */
        .chat-input-area { border-top:1px solid #E8F4FB; padding:10px 12px 10px; background:#fff; flex-shrink:0; }
        .chat-attachments-bar { display:flex; align-items:center; gap:6px; margin-bottom:7px; flex-wrap:wrap; }
        .chat-attach-chip { display:inline-flex; align-items:center; gap:5px; background:#EFF8FF; border:1px solid #BFDBFE; border-radius:6px; padding:3px 9px; font-size:11.5px; color:#1D4ED8; font-weight:600; }
        .chat-tools { display:flex; gap:5px; margin-bottom:7px; }
        .chat-tool-btn { display:flex; align-items:center; gap:4px; padding:4px 9px; border:1.5px solid #C5DFF0; border-radius:7px; background:#fff; font-size:11.5px; color:var(--teal,#1A7FA8); cursor:pointer; font-weight:600; }
        .chat-tool-btn:hover, .chat-tool-btn.active { background:#DBEAFE; border-color:#93C5FD; color:#1D4ED8; }
        .chat-link-form { background:#F0F8FF; border:1px solid #C5DFF0; border-radius:9px; padding:9px 11px; margin-bottom:7px; display:flex; flex-direction:column; gap:6px; }
        .chat-link-input { border:1.5px solid #C5DFF0; border-radius:7px; padding:6px 9px; font-size:12.5px; font-family:inherit; outline:none; }
        .chat-link-input:focus { border-color:#1A7FA8; }
        .chat-row { display:flex; gap:7px; align-items:flex-end; }
        .chat-textarea { flex:1; border:1.5px solid #C5DFF0; border-radius:10px; padding:8px 11px; font-size:13px; font-family:inherit; resize:none; outline:none; min-height:38px; max-height:90px; transition:border-color .15s; }
        .chat-textarea:focus { border-color:#1A7FA8; }
        .chat-send-btn { width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,#1A7FA8,#0B4F6C); border:none; color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }
        .chat-send-btn:disabled { opacity:.5; cursor:not-allowed; }
        .chat-picker { position:absolute; bottom:100%; left:0; right:0; background:#fff; border:1px solid #C5DFF0; border-radius:10px 10px 0 0; box-shadow:0 -4px 16px rgba(11,79,108,0.1); max-height:180px; overflow-y:auto; z-index:10; }
        .chat-picker-item { display:flex; align-items:center; gap:8px; padding:8px 12px; cursor:pointer; font-size:13px; }
        .chat-picker-item:hover { background:#F0F8FF; }
        .chat-picker-label { font-size:11px; text-transform:uppercase; color:#9BBDD4; padding:6px 12px 3px; font-weight:600; letter-spacing:.06em; }
        .chat-empty { text-align:center; color:#9BBDD4; font-size:13px; padding:32px 16px; }
        .chat-mention-chips { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:6px; }
        .chat-mention-chip { display:inline-flex; align-items:center; gap:4px; background:#EDE9FE; color:#5B21B6; border-radius:999px; padding:2px 8px; font-size:11px; font-weight:600; }
        .chat-ref-chip { display:inline-flex; align-items:center; gap:5px; background:#DBEAFE; color:#1D4ED8; border-radius:6px; padding:3px 8px; font-size:11.5px; font-weight:600; margin-bottom:6px; }
        .chat-error { font-size:12px; color:#DC2626; padding:4px 12px; }
      `}</style>

      {open && (
        <div className="chat-panel">
          <div className="chat-head">
            <div>
              <div className="chat-head-title">
                <span style={{ fontSize:16 }}>💬</span>
                {project.name}
              </div>
              <div className="chat-head-sub">{messages.length} message{messages.length !== 1 ? "s" : ""}</div>
            </div>
            <X size={16} style={{ cursor:"pointer", color:"rgba(255,255,255,0.75)", flexShrink:0 }} onClick={onToggleOpen} />
          </div>

          <div className="chat-thread">
            {messages.length === 0 && (
              <div className="chat-empty">No messages yet.<br />Start the thread!</div>
            )}
            {messages.map((m) => {
              const isMine = m.author_id === currentUser.id;
              return (
                <div className={`chat-thread-msg ${isMine ? "mine" : ""}`} key={m.id}>
                  <div className="chat-thread-avatar" style={{ background: m.author_color || "#1A7FA8" }}>
                    {m.author_initials || m.author_name?.[0]}
                  </div>
                  <div className="chat-thread-body">
                    <div className="chat-thread-meta">
                      <span className="chat-thread-name">{isMine ? "You" : m.author_name}</span>
                      <span className="chat-thread-time">{timeAgo(m.created_at)}</span>
                    </div>
                    <div className="chat-thread-text">
                      {m.task_ref_id && (
                        <div
                          className={`chat-task-chip ${isMine ? "" : "other"}`}
                          onClick={() => onOpenTask && onOpenTask(m.task_ref_id)}
                        >
                          # {m.task_ref_title || `Task #${m.task_ref_id}`}
                        </div>
                      )}
                      <div>{renderMessageBody(m.body)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {error && <div className="chat-error">{error}</div>}

          {readOnly ? (
            <div className="chat-input-area" style={{ fontSize: 12.5, color: "var(--muted, #6B92AD)", textAlign: "center", padding: "10px 6px" }}>
              You have view-only access to this project.
            </div>
          ) : (
          <div className="chat-input-area" style={{ position:"relative" }}>
            {showTaskPicker && (
              <div className="chat-picker">
                <div className="chat-picker-label">Reference a task</div>
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
                    <div className="chat-thread-avatar" style={{ background: m.color, width:22, height:22, fontSize:9, border:"none", boxShadow:"none" }}>{m.initials}</div>
                    {m.name}
                  </div>
                ))}
              </div>
            )}

            {/* Attachment / link chips */}
            {(attachFile || (showLinkForm && linkLabel)) && (
              <div className="chat-attachments-bar">
                {attachFile && (
                  <span className="chat-attach-chip">
                    <Paperclip size={11} /> {attachFile.name}
                    <X size={10} style={{ cursor:"pointer" }} onClick={() => { setAttachFile(null); if (chatFileRef.current) chatFileRef.current.value = ""; }} />
                  </span>
                )}
              </div>
            )}

            {showLinkForm && (
              <div className="chat-link-form">
                <input className="chat-link-input" placeholder="Link name (e.g. Shared Folder)" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} />
                <input className="chat-link-input" placeholder="URL (e.g. https://…)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
              </div>
            )}

            {/* Tool buttons */}
            <div className="chat-tools">
              <button className={`chat-tool-btn ${showTaskPicker?"active":""}`} onClick={() => { setShowTaskPicker((v)=>!v); setShowMentionPicker(false); }}>
                <Hash size={13} /> Task
              </button>
              <button className={`chat-tool-btn ${showMentionPicker?"active":""}`} onClick={() => { setShowMentionPicker((v)=>!v); setShowTaskPicker(false); }}>
                <AtSign size={13} /> Mention
              </button>
              <button className="chat-tool-btn" onClick={() => chatFileRef.current?.click()}>
                <Paperclip size={13} /> File
              </button>
              <button className={`chat-tool-btn ${showLinkForm?"active":""}`} onClick={() => setShowLinkForm((v)=>!v)}>
                <Link size={13} /> Link
              </button>
              <input ref={chatFileRef} type="file" style={{ display:"none" }} onChange={(e) => { if (e.target.files[0]) setAttachFile(e.target.files[0]); }} />
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
                placeholder="Write a message… (@ to mention, Enter to send)"
                value={body}
                onChange={handleBodyChange}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={1}
              />
              <button className="chat-send-btn" onClick={send} disabled={sending || (!body.trim() && !attachFile && !selectedTaskRef && !(showLinkForm && linkLabel.trim() && linkUrl.trim()))}>
                <Send size={15} />
              </button>
            </div>
          </div>
          )}
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
