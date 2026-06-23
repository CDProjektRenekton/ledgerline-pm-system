import React, { useState } from "react";
import { api, setToken } from "./api";

const LOGO_HORIZ = "https://i.ibb.co/KjjLW3nt/mwss-logo-horiz-flat-01.png";

export default function Login({ onAuthed, resetToken, verifyToken }) {
  const [mode, setMode] = useState(resetToken ? "reset" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    try {
      if (mode === "login") {
        const data = await api.login(email, password);
        setToken(data.token);
        onAuthed(data.token, data.user);
      } else if (mode === "register") {
        const data = await api.register(name, email, password);
        setToken(data.token);
        onAuthed(data.token, data.user);
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
    login: "Sign in to your workspace",
    register: "Create a new account",
    forgot: "Enter your email to receive a reset link",
    reset: "Choose a new password",
  };
  const btnLabels = {
    login: "Sign in",
    register: "Create account",
    forgot: "Send reset link",
    reset: "Update password",
  };

  return (
    <div style={s.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:wght@700&display=swap');

        * { box-sizing: border-box; }

        .login-root { display:flex; min-height:100vh; font-family:'Inter',sans-serif; }

        /* ---- Left panel ---- */
        .login-left {
          flex: 1.1;
          background: linear-gradient(160deg, #0B4F6C 0%, #1A7FA8 45%, #22A0CC 100%);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 48px 56px; position: relative; overflow: hidden;
        }
        .login-left::before {
          content:''; position:absolute; inset:0;
          background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='%23ffffff08' d='M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z'/%3E%3C/svg%3E") bottom/cover no-repeat;
        }
        .login-left::after {
          content:''; position:absolute; bottom:-60px; left:-60px;
          width:320px; height:320px; border-radius:50%;
          background: rgba(255,255,255,0.05);
        }

        .login-logo-wrap { position:relative; z-index:1; width:100%; max-width:420px; }
        .login-logo-img { width:100%; max-width:380px; display:block; margin-bottom:32px; }
        .login-left-title {
          font-family:'Merriweather',serif; font-size:28px; color:#fff; line-height:1.3;
          font-weight:700; max-width:380px; margin-bottom:14px;
        }
        .login-left-sub { font-size:14px; color:rgba(255,255,255,0.75); max-width:360px; line-height:1.6; }

        .login-wave-row { position:absolute; bottom:0; left:0; right:0; z-index:1; }
        .login-bubbles { position:absolute; top:0; left:0; right:0; bottom:0; pointer-events:none; overflow:hidden; }
        .login-bubble {
          position:absolute; border-radius:50%; background:rgba(255,255,255,0.06);
          animation: rise 8s infinite ease-in;
        }
        @keyframes rise {
          0%   { transform: translateY(0)   scale(1);   opacity:0.6; }
          100% { transform: translateY(-110vh) scale(1.3); opacity:0; }
        }

        /* ---- Right panel ---- */
        .login-right {
          flex:0.9; background:#F0F8FF; display:flex; flex-direction:column;
          align-items:center; justify-content:center; padding:40px 48px;
        }
        .login-card { width:100%; max-width:380px; }
        .login-card-title { font-size:23px; font-weight:700; color:#0B4F6C; margin:0 0 4px; }
        .login-card-sub { font-size:13px; color:#5A8FAA; margin:0 0 26px; }

        .login-input {
          width:100%; border:1.5px solid #C5DFF0; border-radius:10px;
          padding:11px 14px; font-size:14px; font-family:'Inter',sans-serif;
          background:#fff; color:#1B2A35; outline:none;
          transition:border-color 0.2s, box-shadow 0.2s;
          margin-bottom:12px; display:block;
        }
        .login-input:focus { border-color:#1A7FA8; box-shadow:0 0 0 3px rgba(26,127,168,0.12); }

        .login-btn {
          width:100%; background:linear-gradient(135deg,#1A7FA8,#0B4F6C);
          color:#fff; border:none; border-radius:10px; padding:12px 0;
          font-size:14px; font-weight:700; cursor:pointer; letter-spacing:0.02em;
          transition:opacity 0.2s; font-family:'Inter',sans-serif; margin-top:4px;
        }
        .login-btn:hover { opacity:0.9; }
        .login-btn:disabled { opacity:0.6; cursor:not-allowed; }

        .login-error { background:#FEE8E8; color:#B91C1C; padding:9px 12px; border-radius:8px; font-size:12.5px; margin-bottom:12px; }
        .login-info  { background:#E0F4FF; color:#0B4F6C;  padding:9px 12px; border-radius:8px; font-size:12.5px; margin-bottom:12px; }

        .login-links { text-align:center; margin-top:18px; font-size:12.5px; color:#5A8FAA; }
        .login-link  { color:#1A7FA8; font-weight:600; cursor:pointer; text-decoration:none; }
        .login-link:hover { text-decoration:underline; }

        .login-powered {
          margin-top:40px; text-align:center; font-size:11.5px; color:#8AAFC4;
          letter-spacing:0.04em;
        }

        /* responsive */
        @media (max-width: 720px) {
          .login-left { display:none; }
          .login-right { padding:32px 24px; background:#F0F8FF; }
        }
      `}</style>

      <div className="login-root">
        {/* ===== Left panel ===== */}
        <div className="login-left">
          {/* Animated water bubbles */}
          <div className="login-bubbles">
            {[
              { left:"8%",  bottom:"10%", size:40,  delay:"0s"   },
              { left:"20%", bottom:"5%",  size:60,  delay:"2.5s" },
              { left:"50%", bottom:"8%",  size:30,  delay:"1.2s" },
              { left:"70%", bottom:"3%",  size:50,  delay:"3.8s" },
              { left:"85%", bottom:"12%", size:35,  delay:"0.8s" },
              { left:"35%", bottom:"15%", size:20,  delay:"5s"   },
            ].map((b, i) => (
              <div
                key={i}
                className="login-bubble"
                style={{
                  left: b.left,
                  bottom: b.bottom,
                  width:  b.size,
                  height: b.size,
                  animationDelay: b.delay,
                  animationDuration: `${7 + i * 1.3}s`,
                }}
              />
            ))}
          </div>

          <div className="login-logo-wrap">
            <img
              src={LOGO_HORIZ}
              alt="MWSS Logo"
              className="login-logo-img"
              onError={(e) => { e.target.style.display = "none"; }}
            />
            <div className="login-left-title">Project Management System</div>
            <div className="login-left-sub">
              Manage projects, track tasks, and collaborate with your team — all in one place.
            </div>
          </div>
        </div>

        {/* ===== Right panel ===== */}
        <div className="login-right">
          <div className="login-card">
            <div className="login-card-title">
              {mode === "login"    ? "Welcome back"       :
               mode === "register" ? "Create account"     :
               mode === "forgot"   ? "Reset password"     :
                                     "Set new password"}
            </div>
            <div className="login-card-sub">{subtitles[mode]}</div>

            {verifyToken && mode === "login" && (
              <div className="login-info">✓ Email verified. You can now sign in.</div>
            )}

            <form onSubmit={submit}>
              {mode === "register" && (
                <input className="login-input" placeholder="Full name" value={name}
                  onChange={(e) => setName(e.target.value)} required />
              )}
              {(mode === "login" || mode === "register" || mode === "forgot") && (
                <input className="login-input" type="email" placeholder="Email address"
                  value={email} onChange={(e) => setEmail(e.target.value)} required />
              )}
              {(mode === "login" || mode === "register") && (
                <input className="login-input" type="password"
                  placeholder={mode === "register" ? "Password (min 8 characters)" : "Password"}
                  value={password} onChange={(e) => setPassword(e.target.value)} required />
              )}
              {mode === "reset" && (
                <input className="login-input" type="password"
                  placeholder="New password (min 8 characters)"
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  required minLength={8} />
              )}

              {error && <div className="login-error">{error}</div>}
              {info  && <div className="login-info">{info}</div>}

              <button className="login-btn" type="submit" disabled={loading}>
                {loading ? "Please wait…" : btnLabels[mode]}
              </button>
            </form>

            <div className="login-links">
              {mode === "login" && (
                <>
                  <div>
                    No account?{" "}
                    <span className="login-link" onClick={() => setMode("register")}>Create one</span>
                  </div>
                  <div style={{ marginTop: 7 }}>
                    <span className="login-link" onClick={() => setMode("forgot")}>Forgot password?</span>
                  </div>
                </>
              )}
              {mode === "register" && (
                <span>Already have an account?{" "}
                  <span className="login-link" onClick={() => setMode("login")}>Sign in</span>
                </span>
              )}
              {(mode === "forgot" || mode === "reset") && (
                <span className="login-link" onClick={() => setMode("login")}>← Back to sign in</span>
              )}
            </div>

            <div className="login-powered">Powered by the Management Information System</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const s = { root: { margin: 0, padding: 0 } };
