import React, { useEffect, useRef, useState } from "react";
import { X, UserPlus, Trash2, Search } from "lucide-react";
import { api } from "./api";

export default function MembersPanel({ token, project, members, currentUser, onMembersChanged, onClose }) {
  const [inviteQuery, setInviteQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const blurTimeout = useRef(null);

  // Debounced autocomplete as the user types a name or email
  useEffect(() => {
    if (!inviteQuery.trim()) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const results = await api.searchUsers(token, inviteQuery.trim());
        // Don't suggest people who are already members
        const memberIds = new Set(members.map((m) => m.id));
        setSuggestions(results.filter((u) => !memberIds.has(u.id)));
      } catch (_) {}
    }, 250);
    return () => clearTimeout(t);
  }, [inviteQuery, token, members]);

  const sendInvite = async (emailOverride) => {
    const email = (emailOverride || inviteQuery).trim();
    if (!email) return;
    setError(""); setInfo(""); setBusy(true);
    try {
      const res = await api.inviteMember(token, project.id, email);
      setInviteQuery("");
      setSuggestions([]);
      setShowSuggestions(false);
      setInfo(res.pending ? "Invitation sent — they'll need to accept it." : "Member added.");
      onMembersChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (userId) => {
    try {
      await api.removeMember(token, project.id, userId);
      onMembersChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-members-modal" onClick={(e) => e.stopPropagation()}>
        <style>{`
          .pm-members-modal { width: 420px; max-width: 92vw; max-height: 85vh; overflow-y: auto; background: var(--card); border-radius: 14px; padding: 22px 24px; margin: auto; }
          .pm-members-head { display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px; }
          .pm-members-title { font-family:'Merriweather', serif; font-size: 19px; font-weight: 700; color: var(--teal-deep); }
          .pm-members-sub { font-size: 12.5px; color: var(--muted); margin-bottom: 16px; }
          .pm-member-row { display:flex; align-items:center; gap: 10px; padding: 8px 6px; border-bottom: 1px solid var(--border); }
          .pm-member-row:last-of-type { border-bottom: none; }
          .pm-member-avatar { width: 30px; height: 30px; border-radius: 50%; display:flex; align-items:center; justify-content:center; color:#fff; font-size: 11px; font-weight: 700; flex-shrink: 0; }
          .pm-member-info { flex: 1; min-width: 0; }
          .pm-member-name { font-size: 13px; font-weight: 600; }
          .pm-member-email { font-size: 11.5px; color: var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
          .pm-member-role { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); background: var(--paper-deep); padding: 2px 8px; border-radius: 999px; flex-shrink: 0; }
          .pm-member-remove { cursor:pointer; color: var(--muted); flex-shrink: 0; }
          .pm-member-remove:hover { color: #DC2626; }
          .pm-invite-wrap { position: relative; margin-top: 18px; }
          .pm-invite-row { display:flex; gap:8px; }
          .pm-invite-row input { flex:1; border: 1.5px solid var(--border); border-radius: 8px; padding: 9px 11px; font-size: 13px; outline:none; }
          .pm-invite-row input:focus { border-color: var(--teal); }
          .pm-members-msg { font-size: 12px; margin-top: 10px; }
          .pm-invite-suggestions { position:absolute; bottom:calc(100% + 4px); left:0; right:0; background:#fff; border:1px solid var(--border); border-radius:10px; box-shadow:0 8px 24px rgba(11,79,108,0.15); max-height:220px; overflow-y:auto; z-index:10; }
          .pm-invite-suggestion { display:flex; align-items:center; gap:9px; padding:9px 12px; cursor:pointer; }
          .pm-invite-suggestion:hover { background: var(--paper-deep); }
          .pm-invite-suggestion-info { flex:1; min-width:0; }
          .pm-invite-suggestion-name { font-size:13px; font-weight:600; }
          .pm-invite-suggestion-email { font-size:11px; color: var(--muted); }
        `}</style>

        <div className="pm-members-head">
          <div className="pm-members-title">Members</div>
          <X size={18} style={{ cursor: "pointer", color: "var(--muted)" }} onClick={onClose} />
        </div>
        <div className="pm-members-sub">
          Search by name or email — they'll get an invite to accept before joining.
        </div>

        {members.map((m) => (
          <div className="pm-member-row" key={m.id}>
            <div className="pm-member-avatar" style={{ background: m.color }}>{m.initials}</div>
            <div className="pm-member-info">
              <div className="pm-member-name">{m.name}{m.id === currentUser.id ? " (you)" : ""}</div>
              <div className="pm-member-email">{m.email}</div>
            </div>
            <span className="pm-member-role">{m.role}</span>
            {m.role !== "owner" && (
              <Trash2 size={14} className="pm-member-remove" onClick={() => remove(m.id)} />
            )}
          </div>
        ))}

        <div className="pm-invite-wrap">
          {showSuggestions && suggestions.length > 0 && (
            <div className="pm-invite-suggestions">
              {suggestions.map((u) => (
                <div key={u.id} className="pm-invite-suggestion" onMouseDown={() => sendInvite(u.email)}>
                  <div className="pm-member-avatar" style={{ background: u.color, width: 26, height: 26, fontSize: 10 }}>{u.initials}</div>
                  <div className="pm-invite-suggestion-info">
                    <div className="pm-invite-suggestion-name">{u.name}</div>
                    <div className="pm-invite-suggestion-email">{u.email}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="pm-invite-row">
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input
                style={{ paddingLeft: 30, width: "100%" }}
                placeholder="Search name or email…"
                value={inviteQuery}
                onChange={(e) => { setInviteQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => e.key === "Enter" && sendInvite()}
              />
            </div>
            <button className="pm-btn-primary" onClick={() => sendInvite()} disabled={busy}>
              <UserPlus size={14} /> Invite
            </button>
          </div>
        </div>
        {error && <div className="pm-members-msg" style={{ color: "#DC2626" }}>{error}</div>}
        {info && <div className="pm-members-msg" style={{ color: "#3F7D52" }}>{info}</div>}
      </div>
    </div>
  );
}
