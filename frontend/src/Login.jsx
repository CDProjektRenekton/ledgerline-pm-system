import React, { useState } from "react";
import { api, setToken } from "./api";

const LOGO_HORIZ = "https://i.ibb.co/KjjLW3nt/mwss-logo-horiz-flat-01.png";

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function PasswordInput({ placeholder, value, onChange, required, minLength }) {
  const [show, setShow] = useState(false);
  return (
    <div className="login-pass-wrap">
      <input
        className="login-input"
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        style={{ paddingRight: 42, marginBottom: 0 }}
      />
      <button
        type="button"
        className="login-eye-btn"
        onClick={() => setShow((v) => !v)}
        tabIndex={-1}
        title={show ? "Hide password" : "Show password"}
      >
        <EyeIcon open={show} />
      </button>
    </div>
  );
}

export default function Login({ onAuthed, resetToken, verifyToken }) {
  const [mode, setMode] = useState(resetToken ? "reset" : "login");
  const [name, setName]             = useState("");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError]   = useState("");
  const [info, setInfo]     = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    try {
      if (mode === "login") {
        const data = await api.login(email, password);
        setToken(data.token); onAuthed(data.token, data.user);
      } else if (mode === "register") {
        const data = await api.register(name, email, password);
        setToken(data.token); onAuthed(data.token, data.user);
      } else if (mode === "forgot") {
        const res = await api.forgotPassword(email);
        setInfo(res.message);
      } else if (mode === "reset") {
        await api.resetPassword(resetToken, newPassword);
        setInfo("Password updated. You can now sign in.");
        window.history.replaceState({}, "", window.location.pathname);
        setTimeout(() => setMode("login"), 1400);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const subtitles = {
    login:    "Sign in to your workspace",
    register: "Create a new account",
    forgot:   "Enter your email to receive a reset link",
    reset:    "Choose a new password for your account",
  };
  const btnLabels = {
    login: "Sign in", register: "Create account",
    forgot: "Send reset link", reset: "Update password",
  };

  return (
    <div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        body { font-family:'Inter',sans-serif; }

        .login-root { display:flex; min-height:100vh; font-family:'Inter',sans-serif; }

        /* ══ LEFT PANEL ══ */
        .login-left {
          flex:1.1;
          background: linear-gradient(160deg,#062B40 0%,#0B4F6C 35%,#1A7FA8 70%,#22A0CC 100%);
          display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          padding:48px 52px;
          position:relative; overflow:hidden; text-align:center;
        }
        /* Grid of faint circles */
        .login-left::before {
          content:''; position:absolute; inset:0;
          background-image: radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px);
          background-size: 36px 36px;
        }
        /* Wave at the bottom */
        .login-wave {
          position:absolute; bottom:0; left:0; right:0; z-index:1; line-height:0;
        }
        .login-bubbles { position:absolute; inset:0; pointer-events:none; overflow:hidden; z-index:1; }
        .lb {
          position:absolute; border-radius:50%;
          background:rgba(255,255,255,0.07);
          animation:rise 8s infinite ease-in;
        }
        @keyframes rise {
          0%   { transform:translateY(0) scale(1);   opacity:0.7; }
          100% { transform:translateY(-110vh) scale(1.2); opacity:0; }
        }

        .login-left-inner { position:relative; z-index:2; display:flex; flex-direction:column; align-items:center; max-width:400px; }

        /* Logo card */
        .login-logo-card {
          background:rgba(255,255,255,0.12);
          backdrop-filter:blur(10px);
          border:1px solid rgba(255,255,255,0.18);
          border-radius:20px;
          padding:22px 32px;
          margin-bottom:28px;
          width:100%;
          display:flex; align-items:center; justify-content:center;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
        }
        .login-logo-img { max-width:280px; height:auto; display:block; }

        /* Decorative pill */
        .login-pill {
          display:inline-flex; align-items:center; gap:7px;
          background:rgba(255,255,255,0.14);
          border:1px solid rgba(255,255,255,0.22);
          border-radius:999px; padding:5px 14px;
          font-size:11.5px; font-weight:600; letter-spacing:0.07em;
          text-transform:uppercase; color:rgba(255,255,255,0.85);
          margin-bottom:16px;
        }
        .login-pill-dot { width:7px; height:7px; border-radius:50%; background:#34D399; box-shadow:0 0 0 3px rgba(52,211,153,0.3); }

        .login-left-title {
          font-family:'Plus Jakarta Sans',sans-serif;
          font-size:30px; font-weight:800; color:#fff; line-height:1.2;
          letter-spacing:-0.01em; margin-bottom:12px;
        }
        .login-left-sub { font-size:14px; color:rgba(255,255,255,0.65); line-height:1.65; max-width:340px; }

        /* Stats row */
        .login-stats {
          display:flex; gap:24px; margin-top:28px;
          justify-content:center;
        }
        .login-stat { text-align:center; }
        .login-stat-num { font-size:22px; font-weight:800; color:#fff; line-height:1; }
        .login-stat-label { font-size:10.5px; color:rgba(255,255,255,0.55); margin-top:3px; letter-spacing:0.05em; text-transform:uppercase; }
        .login-stat-divider { width:1px; background:rgba(255,255,255,0.18); align-self:stretch; }

        /* ══ RIGHT PANEL ══ */
        .login-right {
          flex:0.9; background:#F0F7FC; display:flex; flex-direction:column;
          align-items:center; justify-content:center; padding:40px 48px;
        }
        .login-card { width:100%; max-width:380px; }

        .login-card-badge {
          display:inline-flex; align-items:center; gap:6px;
          background:#DBEAFE; color:#1D4ED8; border-radius:999px;
          padding:4px 12px; font-size:11.5px; font-weight:600;
          margin-bottom:14px; letter-spacing:0.03em;
        }
        .login-card-title { font-size:24px; font-weight:700; color:#0B2233; margin:0 0 5px; }
        .login-card-sub   { font-size:13px; color:#5A8FAA; margin:0 0 24px; }

        .login-input {
          width:100%; border:1.5px solid #C5DFF0; border-radius:10px;
          padding:11px 14px; font-size:14px; font-family:'Inter',sans-serif;
          background:#fff; color:#1B2A35; outline:none;
          transition:border-color .18s, box-shadow .18s;
          margin-bottom:12px; display:block;
        }
        .login-input:focus { border-color:#1A7FA8; box-shadow:0 0 0 3px rgba(26,127,168,0.12); }

        .login-pass-wrap { position:relative; margin-bottom:12px; }
        .login-pass-wrap .login-input { padding-right:44px; margin-bottom:0; }
        .login-eye-btn {
          position:absolute; right:12px; top:50%; transform:translateY(-50%);
          background:none; border:none; cursor:pointer; color:#6B92AD;
          display:flex; align-items:center; padding:2px;
          transition:color .15s;
        }
        .login-eye-btn:hover { color:#1A7FA8; }

        .login-btn {
          width:100%; background:linear-gradient(135deg,#1A7FA8,#0B4F6C);
          color:#fff; border:none; border-radius:10px; padding:13px 0;
          font-size:14.5px; font-weight:700; cursor:pointer; letter-spacing:0.02em;
          transition:opacity .18s, transform .18s, box-shadow .18s;
          font-family:'Inter',sans-serif; margin-top:4px;
          box-shadow:0 4px 14px rgba(26,127,168,0.28);
        }
        .login-btn:hover { opacity:.91; transform:translateY(-1px); box-shadow:0 6px 20px rgba(26,127,168,0.35); }
        .login-btn:disabled { opacity:.6; cursor:not-allowed; transform:none; }

        .login-divider { display:flex; align-items:center; gap:10px; margin:16px 0; }
        .login-divider-line { flex:1; height:1px; background:#C5DFF0; }
        .login-divider-text { font-size:11.5px; color:#8AAFC4; }

        .login-error { background:#FEE2E2; color:#991B1B; padding:10px 12px; border-radius:8px; font-size:12.5px; margin-bottom:12px; }
        .login-info  { background:#DBEAFE; color:#1E40AF; padding:10px 12px; border-radius:8px; font-size:12.5px; margin-bottom:12px; }

        .login-links { text-align:center; margin-top:18px; font-size:12.5px; color:#5A8FAA; }
        .login-link  { color:#1A7FA8; font-weight:600; cursor:pointer; }
        .login-link:hover { text-decoration:underline; }

        .login-powered {
          margin-top:32px; text-align:center; font-size:11px; color:#9BBDD4;
          letter-spacing:0.04em; padding-top:16px;
          border-top:1px solid #C5DFF0;
        }

        @media (max-width:720px) {
          .login-left { display:none; }
          .login-right { padding:28px 20px; }
        }
      `}</style>

      <div className="login-root">

        {/* ═══ LEFT ═══ */}
        <div className="login-left">
          <div className="login-bubbles">
            {[
              { l:"8%",  b:"8%",  s:44, d:"0s"   },
              { l:"22%", b:"4%",  s:62, d:"2.3s"  },
              { l:"52%", b:"7%",  s:32, d:"1.1s"  },
              { l:"72%", b:"2%",  s:54, d:"3.6s"  },
              { l:"87%", b:"11%", s:38, d:"0.6s"  },
              { l:"38%", b:"14%", s:22, d:"5.2s"  },
              { l:"60%", b:"18%", s:18, d:"4s"    },
            ].map((b, i) => (
              <div key={i} className="lb" style={{
                left:b.l, bottom:b.b, width:b.s, height:b.s,
                animationDelay:b.d, animationDuration:`${6.5+i*1.4}s`,
              }} />
            ))}
          </div>

          <div className="login-left-inner">
            <div className="login-logo-card">
              <img src={LOGO_HORIZ} alt="MWSS Logo" className="login-logo-img"
                onError={(e) => { e.target.style.display="none"; }} />
            </div>

            <div className="login-pill">
              <span className="login-pill-dot" />
              MWSS Regional Office
            </div>

            <div className="login-left-title">Project Management System</div>
            <div className="login-left-sub">
              Track tasks, collaborate with your team, and deliver projects on time — all in one place.
            </div>

            <div className="login-stats">
              <div className="login-stat">
                <div className="login-stat-num">4</div>
                <div className="login-stat-label">Views</div>
              </div>
              <div className="login-stat-divider" />
              <div className="login-stat">
                <div className="login-stat-num">∞</div>
                <div className="login-stat-label">Tasks</div>
              </div>
              <div className="login-stat-divider" />
              <div className="login-stat">
                <div className="login-stat-num">⚡</div>
                <div className="login-stat-label">Real-time</div>
              </div>
            </div>
          </div>

          {/* Bottom wave */}
          <div className="login-wave">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 60" style={{display:"block"}}>
              <path fill="rgba(255,255,255,0.06)" d="M0,32L60,26C120,21,240,10,360,13C480,16,600,32,720,37C840,43,960,37,1080,29C1200,21,1320,10,1380,5L1440,0L1440,60L0,60Z"/>
            </svg>
          </div>
        </div>

        {/* ═══ RIGHT ═══ */}
        <div className="login-right">
          <div className="login-card">
            <div className="login-card-badge">
              🔐 {mode === "login" ? "Secure Sign-In" : mode === "register" ? "New Account" : mode === "forgot" ? "Password Reset" : "Set Password"}
            </div>
            <div className="login-card-title">
              {mode==="login"    ? "Welcome back"     :
               mode==="register" ? "Create account"   :
               mode==="forgot"   ? "Forgot password?" : "New password"}
            </div>
            <div className="login-card-sub">{subtitles[mode]}</div>

            {verifyToken && mode === "login" && (
              <div className="login-info">✓ Email verified. You can now sign in.</div>
            )}

            <form onSubmit={submit}>
              {mode === "register" && (
                <input className="login-input" placeholder="Full name"
                  value={name} onChange={(e) => setName(e.target.value)} required />
              )}

              {(mode==="login"||mode==="register"||mode==="forgot") && (
                <input className="login-input" type="email" placeholder="Email address"
                  value={email} onChange={(e) => setEmail(e.target.value)} required />
              )}

              {(mode==="login"||mode==="register") && (
                <PasswordInput
                  placeholder={mode==="register" ? "Password (min 8 characters)" : "Password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              )}

              {mode==="reset" && (
                <PasswordInput
                  placeholder="New password (min 8 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              )}

              {error && <div className="login-error">{error}</div>}
              {info  && <div className="login-info">{info}</div>}

              <button className="login-btn" type="submit" disabled={loading}>
                {loading ? "Please wait…" : btnLabels[mode]}
              </button>
            </form>

            <div className="login-links">
              {mode==="login" && (
                <>
                  <div>No account?{" "}<span className="login-link" onClick={()=>setMode("register")}>Create one</span></div>
                  <div style={{marginTop:7}}><span className="login-link" onClick={()=>setMode("forgot")}>Forgot password?</span></div>
                </>
              )}
              {mode==="register" && (
                <span>Already have an account?{" "}<span className="login-link" onClick={()=>setMode("login")}>Sign in</span></span>
              )}
              {(mode==="forgot"||mode==="reset") && (
                <span className="login-link" onClick={()=>setMode("login")}>← Back to sign in</span>
              )}
            </div>

            <div className="login-powered">Powered by the Management Information System</div>
          </div>
        </div>
      </div>
    </div>
  );
}
