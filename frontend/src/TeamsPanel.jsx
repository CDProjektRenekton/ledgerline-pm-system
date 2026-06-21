import React, { useState } from "react";
import { X, Plus, UserPlus, Trash2 } from "lucide-react";
import { api } from "./api";

const TEAM_COLORS = ["#1F6F78", "#C9A227", "#9C4221", "#3F7D52", "#5C7A89"];

export default function TeamsPanel({ token, project, members, teams, onTeamsChanged, onClose }) {
  const [newTeamName, setNewTeamName] = useState("");
  const [addingTo, setAddingTo] = useState(null); // team id currently showing the "add member" select
  const [error, setError] = useState("");

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      await api.createTeam(token, project.id, newTeamName.trim(), TEAM_COLORS[teams.length % TEAM_COLORS.length]);
      setNewTeamName("");
      onTeamsChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeTeam = async (id) => {
    try {
      await api.deleteTeam(token, id);
      onTeamsChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const addMember = async (teamId, userId) => {
    if (!userId) return;
    try {
      await api.addTeamMember(token, teamId, Number(userId));
      setAddingTo(null);
      onTeamsChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeMember = async (teamId, userId) => {
    try {
      await api.removeTeamMember(token, teamId, userId);
      onTeamsChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-teams-modal" onClick={(e) => e.stopPropagation()}>
        <style>{`
          .pm-teams-modal { width: 460px; max-width: 92vw; max-height: 85vh; overflow-y: auto; background: var(--card); border-radius: 14px; padding: 22px 24px; margin: auto; }
          .pm-teams-head { display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px; }
          .pm-teams-title { font-family:'Fraunces', serif; font-size: 19px; font-weight: 600; }
          .pm-teams-sub { font-size: 12.5px; color: var(--muted); margin-bottom: 18px; }
          .pm-team-card { background: var(--paper-deep); border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; }
          .pm-team-card-head { display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px; }
          .pm-team-name { display:flex; align-items:center; gap:8px; font-weight: 700; font-size: 13.5px; }
          .pm-team-swatch { width: 10px; height: 10px; border-radius: 3px; }
          .pm-team-del { cursor:pointer; color: var(--muted); }
          .pm-team-del:hover { color: #9C4221; }
          .pm-team-members { display:flex; flex-wrap:wrap; gap: 6px; }
          .pm-team-member-chip { display:flex; align-items:center; gap:5px; background: var(--card); border: 1px solid var(--border); border-radius: 999px; padding: 3px 8px 3px 3px; font-size: 11.5px; }
          .pm-chip-avatar { width: 18px; height: 18px; border-radius: 50%; display:flex; align-items:center; justify-content:center; color:#fff; font-size: 8px; font-weight: 700; }
          .pm-chip-remove { cursor:pointer; color: var(--muted); }
          .pm-team-add-btn { display:inline-flex; align-items:center; gap: 5px; font-size: 11.5px; color: var(--teal); cursor:pointer; margin-top: 4px; }
          .pm-team-add-select { font-size: 12px; margin-top: 6px; padding: 5px 8px; border-radius: 6px; border: 1px solid var(--border); width: 100%; }
          .pm-new-team-row { display:flex; gap:8px; margin-top: 16px; }
          .pm-new-team-row input { flex:1; border: 1px solid var(--border); border-radius: 8px; padding: 9px 11px; font-size: 13px; outline:none; }
        `}</style>

        <div className="pm-teams-head">
          <div className="pm-teams-title">Teams</div>
          <X size={18} style={{ cursor: "pointer", color: "var(--muted)" }} onClick={onClose} />
        </div>
        <div className="pm-teams-sub">Group members so you can assign a task to everyone at once.</div>

        {error && <div style={{ color: "#9C4221", fontSize: 12, marginBottom: 10 }}>{error}</div>}

        {teams.map((t) => {
          const memberIds = new Set(t.members.map((m) => m.id));
          const available = members.filter((m) => !memberIds.has(m.id));
          return (
            <div className="pm-team-card" key={t.id}>
              <div className="pm-team-card-head">
                <div className="pm-team-name">
                  <span className="pm-team-swatch" style={{ background: t.color }} />
                  {t.name}
                </div>
                <Trash2 size={14} className="pm-team-del" onClick={() => removeTeam(t.id)} />
              </div>

              <div className="pm-team-members">
                {t.members.map((m) => (
                  <div className="pm-team-member-chip" key={m.id}>
                    <span className="pm-chip-avatar" style={{ background: m.color }}>{m.initials}</span>
                    {m.name.split(" ")[0]}
                    <X size={11} className="pm-chip-remove" onClick={() => removeMember(t.id, m.id)} />
                  </div>
                ))}
                {t.members.length === 0 && (
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>No members yet</span>
                )}
              </div>

              {addingTo === t.id ? (
                <select
                  className="pm-team-add-select"
                  autoFocus
                  defaultValue=""
                  onChange={(e) => addMember(t.id, e.target.value)}
                  onBlur={() => setAddingTo(null)}
                >
                  <option value="" disabled>Add a member…</option>
                  {available.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              ) : (
                available.length > 0 && (
                  <div className="pm-team-add-btn" onClick={() => setAddingTo(t.id)}>
                    <UserPlus size={12} /> Add member
                  </div>
                )
              )}
            </div>
          );
        })}

        <div className="pm-new-team-row">
          <input
            placeholder="New team name…"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createTeam()}
          />
          <button className="pm-btn-primary" onClick={createTeam}>
            <Plus size={14} /> Create
          </button>
        </div>
      </div>
    </div>
  );
}
