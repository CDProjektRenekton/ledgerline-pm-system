import React, { useState } from "react";
import { X, UserPlus, Trash2 } from "lucide-react";
import { api } from "./api";

export default function MembersPanel({ token, project, members, currentUser, onMembersChanged, onClose }) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const member = await api.inviteMember(token, project.id, inviteEmail.trim());
      setInviteEmail("");
      setInfo(`${member.name} added to the project.`);
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
          .pm-members-title { font-family:'Fraunces', serif; font-size: 19px; font-weight: 600; }
          .pm-members-sub { font-size: 12.5px; color: var(--muted); margin-bottom: 16px; }
          .pm-member-row { display:flex; align-items:center; gap: 10px; padding: 8px 6px; border-bottom: 1px solid var(--border); }
          .pm-member-row:last-of-type { border-bottom: none; }
          .pm-member-avatar { width: 30px; height: 30px; border-radius: 50%; display:flex; align-items:center; justify-content:center; color:#fff; font-size: 11px; font-weight: 700; flex-shrink: 0; }
          .pm-member-info { flex: 1; min-width: 0; }
          .pm-member-name { font-size: 13px; font-weight: 600; }
          .pm-member-email { font-size: 11.5px; color: var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
          .pm-member-role { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); background: var(--paper-deep); padding: 2px 8px; border-radius: 999px; flex-shrink: 0; }
          .pm-member-remove { cursor:pointer; color: var(--muted); flex-shrink: 0; }
          .pm-member-remove:hover { color: #9C4221; }
          .pm-invite-row { display:flex; gap:8px; margin-top: 18px; }
          .pm-invite-row input { flex:1; border: 1px solid var(--border); border-radius: 8px; padding: 9px 11px; font-size: 13px; outline:none; }
          .pm-members-msg { font-size: 12px; margin-top: 10px; }
        `}</style>

        <div className="pm-members-head">
          <div className="pm-members-title">Members</div>
          <X size={18} style={{ cursor: "pointer", color: "var(--muted)" }} onClick={onClose} />
        </div>
        <div className="pm-members-sub">
          Add anyone who already has a Ledgerline account by email — they'll then show up as an assignee option.
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

        <div className="pm-invite-row">
          <input
            type="email"
            placeholder="teammate@email.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && invite()}
          />
          <button className="pm-btn-primary" onClick={invite} disabled={busy}>
            <UserPlus size={14} /> Invite
          </button>
        </div>
        {error && <div className="pm-members-msg" style={{ color: "#9C4221" }}>{error}</div>}
        {info && <div className="pm-members-msg" style={{ color: "#3F7D52" }}>{info}</div>}
      </div>
    </div>
  );
}
