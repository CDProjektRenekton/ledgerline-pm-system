import React, { useEffect, useState } from "react";
import { X, Check, Edit2, KeyRound, ShieldCheck, ShieldOff, Power, PowerOff, RotateCw } from "lucide-react";
import { api } from "./api";
import { getSystemPalette, DEFAULT_PALETTE } from "./themes.js";

const FIELD_LABELS = {
  teal: "Accent",
  tealDeep: "Accent (deep)",
  paper: "Background",
  paperDeep: "Background (deep)",
  card: "Card / Panel",
  ink: "Text",
  muted: "Muted text",
  border: "Border",
  sidebarFrom: "Sidebar gradient — start",
  sidebarTo: "Sidebar gradient — end",
};
const FIELD_ORDER = ["teal", "tealDeep", "sidebarFrom", "sidebarTo", "paper", "paperDeep", "card", "ink", "muted", "border"];

export default function AdminPanel({ token, currentUser, systemTheme, onSystemThemeChanged, onClose }) {
  const [tab, setTab] = useState("users"); // users | theme
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: "", email: "" });
  const [resetPwId, setResetPwId] = useState(null);
  const [resetPwValue, setResetPwValue] = useState("");
  const [busyId, setBusyId] = useState(null);

  const [palette, setPalette] = useState(() => getSystemPalette(systemTheme));
  const [themeSaving, setThemeSaving] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await api.adminListUsers(token);
      setUsers(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => { setPalette(getSystemPalette(systemTheme)); }, [systemTheme]);

  const flash = (type, text) => { if (type === "ok") { setInfo(text); setError(""); } else { setError(text); setInfo(""); } };

  const startEdit = (u) => { setEditingId(u.id); setEditDraft({ name: u.name, email: u.email }); setResetPwId(null); };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = async (id) => {
    setBusyId(id);
    try {
      const updated = await api.adminUpdateUser(token, id, editDraft);
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
      setEditingId(null);
      flash("ok", "User updated.");
    } catch (err) {
      flash("err", err.message);
    } finally {
      setBusyId(null);
    }
  };

  const doResetPassword = async (id) => {
    if (resetPwValue.length < 8) { flash("err", "New password must be at least 8 characters."); return; }
    setBusyId(id);
    try {
      await api.adminResetPassword(token, id, resetPwValue);
      setResetPwId(null);
      setResetPwValue("");
      flash("ok", "Password reset.");
    } catch (err) {
      flash("err", err.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (u) => {
    if (u.id === currentUser.id && u.is_active) {
      flash("err", "You can't deactivate your own account.");
      return;
    }
    setBusyId(u.id);
    try {
      await api.adminSetActive(token, u.id, !u.is_active);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_active: !u.is_active } : x)));
      flash("ok", !u.is_active ? "Account reactivated." : "Account deactivated.");
    } catch (err) {
      flash("err", err.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleSuperAdmin = async (u) => {
    setBusyId(u.id);
    try {
      await api.adminSetSuperAdmin(token, u.id, !u.is_super_admin);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_super_admin: !u.is_super_admin } : x)));
      flash("ok", !u.is_super_admin ? "Granted super admin access." : "Revoked super admin access.");
    } catch (err) {
      flash("err", err.message);
    } finally {
      setBusyId(null);
    }
  };

  const saveTheme = async () => {
    setThemeSaving(true);
    try {
      const res = await api.updateSystemTheme(token, palette);
      onSystemThemeChanged({ theme: res.theme, defaults: systemTheme?.defaults || DEFAULT_PALETTE });
      flash("ok", "System theme saved for everyone using the Default theme.");
    } catch (err) {
      flash("err", err.message);
    } finally {
      setThemeSaving(false);
    }
  };

  const resetTheme = async () => {
    setThemeSaving(true);
    try {
      await api.resetSystemTheme(token);
      const fresh = await api.getSystemTheme();
      onSystemThemeChanged(fresh);
      setPalette(getSystemPalette(fresh));
      flash("ok", "System theme reset to default.");
    } catch (err) {
      flash("err", err.message);
    } finally {
      setThemeSaving(false);
    }
  };

  return (
    <div className="pm-overlay" style={{ justifyContent: "center", alignItems: "center" }} onClick={onClose}>
      <div className="pm-admin-modal" onClick={(e) => e.stopPropagation()}>
        <style>{`
          .pm-admin-modal { width: 780px; max-width: 94vw; max-height: 88vh; overflow-y: auto; background: var(--card); border-radius: 14px; padding: 26px 28px; }
          .pm-admin-head { display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px; }
          .pm-admin-title { font-family:'Merriweather', serif; font-size: 19px; font-weight: 700; color: var(--teal-deep); }
          .pm-admin-sub { font-size: 12.5px; color: var(--muted); margin-bottom: 18px; }
          .pm-admin-tabs { display:flex; gap:4px; margin-bottom:18px; background: var(--paper-deep); border-radius:10px; padding:4px; width: fit-content; }
          .pm-admin-tab { padding:7px 16px; font-size:12.5px; font-weight:700; border:none; border-radius:7px; cursor:pointer; background:transparent; color: var(--muted); }
          .pm-admin-tab.active { background:#fff; color: var(--teal-deep); box-shadow: 0 1px 4px rgba(11,79,108,0.12); }
          .pm-admin-table { width:100%; border-collapse: collapse; font-size: 12.5px; }
          .pm-admin-table th { text-align:left; font-size:10.5px; text-transform:uppercase; letter-spacing:0.05em; color: var(--muted); padding: 6px 8px; border-bottom: 1px solid var(--border); }
          .pm-admin-table td { padding: 8px; border-bottom: 1px solid var(--border); vertical-align: middle; }
          .pm-admin-avatar { width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-size:10px; font-weight:700; flex-shrink:0; }
          .pm-admin-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; display:inline-block; }
          .pm-admin-badge.active { background:#D1FAE5; color:#065F46; }
          .pm-admin-badge.inactive { background:#FEE2E2; color:#991B1B; }
          .pm-admin-badge.super { background:#DBEAFE; color:#1D4ED8; margin-left:5px; }
          .pm-admin-icon-btn { background:transparent; border:1.5px solid var(--border); border-radius:7px; width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; color: var(--teal); margin-right:4px; }
          .pm-admin-icon-btn:hover { background: var(--paper-deep); }
          .pm-admin-icon-btn:disabled { opacity:0.5; cursor:not-allowed; }
          .pm-admin-input { border:1.5px solid var(--border); border-radius:7px; padding:5px 8px; font-size:12.5px; outline:none; width:100%; font-family:'Inter',sans-serif; }
          .pm-admin-input:focus { border-color: var(--teal); }
          .pm-admin-msg { font-size:12px; margin-bottom:12px; padding:9px 12px; border-radius:8px; }
          .pm-theme-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 14px 20px; margin-bottom: 20px; }
          .pm-theme-field { display:flex; align-items:center; gap:10px; }
          .pm-theme-field label { flex:1; font-size:12.5px; color: var(--ink); }
          .pm-theme-swatch-row { display:flex; align-items:center; gap:8px; }
          .pm-theme-swatch-row input[type=color] { width:36px; height:28px; border:1.5px solid var(--border); border-radius:6px; cursor:pointer; padding:0; background:none; }
          .pm-theme-swatch-row input[type=text] { width:82px; }
          .pm-theme-preview { border-radius:12px; padding:16px; margin-bottom:20px; border: 1.5px solid var(--border); }
        `}</style>

        <div className="pm-admin-head">
          <div className="pm-admin-title">Super Admin</div>
          <X size={18} style={{ cursor: "pointer", color: "var(--muted)" }} onClick={onClose} />
        </div>
        <div className="pm-admin-sub">Manage every account in the system and customize the default theme everyone sees.</div>

        <div className="pm-admin-tabs">
          <button className={`pm-admin-tab ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>👥 Users</button>
          <button className={`pm-admin-tab ${tab === "theme" ? "active" : ""}`} onClick={() => setTab("theme")}>🎨 System Theme</button>
        </div>

        {info && <div className="pm-admin-msg" style={{ background: "#D1FAE5", color: "#065F46" }}>{info}</div>}
        {error && <div className="pm-admin-msg" style={{ background: "#FEE2E2", color: "#991B1B" }}>{error}</div>}

        {tab === "users" && (
          loading ? (
            <div style={{ padding: 20, color: "var(--muted)" }}>Loading users…</div>
          ) : (
            <table className="pm-admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Login (email)</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isEditing = editingId === u.id;
                  const isResetting = resetPwId === u.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div className="pm-admin-avatar" style={{ background: u.color }}>{u.initials}</div>
                          {isEditing ? (
                            <input
                              className="pm-admin-input"
                              value={editDraft.name}
                              onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                            />
                          ) : (
                            <span style={{ fontWeight: 600 }}>{u.name}{u.id === currentUser.id ? " (you)" : ""}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ minWidth: 160 }}>
                        {isEditing ? (
                          <input
                            className="pm-admin-input"
                            value={editDraft.email}
                            onChange={(e) => setEditDraft((d) => ({ ...d, email: e.target.value }))}
                          />
                        ) : (
                          <span style={{ color: "var(--muted)" }}>{u.email}</span>
                        )}
                        {isResetting && (
                          <div style={{ marginTop: 6, display: "flex", gap: 5 }}>
                            <input
                              className="pm-admin-input"
                              type="password"
                              placeholder="New password (min 8 chars)"
                              value={resetPwValue}
                              onChange={(e) => setResetPwValue(e.target.value)}
                            />
                            <button className="pm-admin-icon-btn" title="Confirm reset" disabled={busyId === u.id} onClick={() => doResetPassword(u.id)}>
                              <Check size={14} />
                            </button>
                            <button className="pm-admin-icon-btn" title="Cancel" onClick={() => { setResetPwId(null); setResetPwValue(""); }}>
                              <X size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`pm-admin-badge ${u.is_active ? "active" : "inactive"}`}>{u.is_active ? "Active" : "Deactivated"}</span>
                        {u.is_super_admin && <span className="pm-admin-badge super">Super Admin</span>}
                      </td>
                      <td style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {isEditing ? (
                          <>
                            <button className="pm-admin-icon-btn" title="Save" disabled={busyId === u.id} onClick={() => saveEdit(u.id)}><Check size={14} /></button>
                            <button className="pm-admin-icon-btn" title="Cancel" onClick={cancelEdit}><X size={14} /></button>
                          </>
                        ) : (
                          <>
                            <button className="pm-admin-icon-btn" title="Edit name/login" onClick={() => startEdit(u)}><Edit2 size={13} /></button>
                            <button className="pm-admin-icon-btn" title="Reset password" onClick={() => { setResetPwId(u.id); setResetPwValue(""); setEditingId(null); }}><KeyRound size={13} /></button>
                            <button
                              className="pm-admin-icon-btn"
                              title={u.is_active ? "Deactivate account" : "Reactivate account"}
                              disabled={busyId === u.id || (u.id === currentUser.id && u.is_active)}
                              onClick={() => toggleActive(u)}
                            >
                              {u.is_active ? <PowerOff size={13} /> : <Power size={13} />}
                            </button>
                            <button
                              className="pm-admin-icon-btn"
                              title={u.is_super_admin ? "Revoke super admin" : "Grant super admin"}
                              disabled={busyId === u.id}
                              onClick={() => toggleSuperAdmin(u)}
                            >
                              {u.is_super_admin ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}

        {tab === "theme" && (
          <div>
            <div className="pm-theme-preview" style={{ background: palette.paper }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(180deg, ${palette.sidebarFrom} 0%, ${palette.sidebarTo} 100%)` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: palette.ink, marginBottom: 4 }}>Preview</div>
                  <div style={{ fontSize: 12, color: palette.muted }}>This is how muted text looks on the background.</div>
                </div>
                <button style={{ background: palette.teal, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>Primary button</button>
              </div>
              <div style={{ marginTop: 12, background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 10, padding: 12 }}>
                <span style={{ color: palette.tealDeep, fontWeight: 700, fontSize: 13 }}>Card / Panel surface</span>
              </div>
            </div>

            <div className="pm-theme-grid">
              {FIELD_ORDER.map((key) => (
                <div className="pm-theme-field" key={key}>
                  <label>{FIELD_LABELS[key]}</label>
                  <div className="pm-theme-swatch-row">
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(palette[key]) ? palette[key] : "#000000"}
                      onChange={(e) => setPalette((p) => ({ ...p, [key]: e.target.value }))}
                    />
                    <input
                      type="text"
                      className="pm-admin-input"
                      value={palette[key]}
                      onChange={(e) => setPalette((p) => ({ ...p, [key]: e.target.value }))}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="pm-btn-ghost" onClick={resetTheme} disabled={themeSaving}>
                <RotateCw size={13} /> Reset to Default
              </button>
              <button className="pm-btn-primary" onClick={saveTheme} disabled={themeSaving}>
                {themeSaving ? "Saving…" : "Save System Theme"}
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10, lineHeight: 1.6 }}>
              This changes the look for every user whose personal theme is set to <strong>Default</strong>.
              Users who picked Dark/Blue/Yellow/White explicitly are unaffected.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
