import React, { useState } from "react";
import { api, setToken } from "./api";

export default function Login({ onAuthed, resetToken }) {
  const [mode, setMode] = useState(resetToken ? "reset" : "login"); // login | register | forgot | reset
  const [name, setName] = useState("");
  const [email, setEmail] = useState("jister@example.com");
  const [password, setPassword] = useState("password123");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
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
        setInfo("Password updated. You can now log in.");
        // Clear the token out of the URL and drop back to the login form.
        window.history.replaceState({}, "", window.location.pathname);
        setTimeout(() => setMode("login"), 1200);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const subtitle = {
    login: "Sign in to your workspace",
    register: "Create your workspace account",
    forgot: "We'll email you a reset link",
    reset: "Choose a new password",
  }[mode];

  const buttonLabel = {
    login: "Sign in",
    register: "Create account",
    forgot: "Send reset link",
    reset: "Update password",
  }[mode];

  return (
    <div style={styles.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap');
      `}</style>
      <div style={styles.card}>
        <div style={styles.mark}>L</div>
        <h1 style={styles.title}>Ledgerline</h1>
        <p style={styles.subtitle}>{subtitle}</p>

        <form onSubmit={submit}>
          {mode === "register" && (
            <input
              style={styles.input}
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}

          {(mode === "login" || mode === "register" || mode === "forgot") && (
            <input
              style={styles.input}
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}

          {(mode === "login" || mode === "register") && (
            <input
              style={styles.input}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}

          {mode === "reset" && (
            <input
              style={styles.input}
              type="password"
              placeholder="New password (min 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          )}

          {error && <div style={styles.error}>{error}</div>}
          {info && <div style={styles.info}>{info}</div>}

          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? "Please wait…" : buttonLabel}
          </button>
        </form>

        <div style={styles.switchRow}>
          {mode === "login" && (
            <>
              <span>
                No account?{" "}
                <a style={styles.link} onClick={() => setMode("register")}>Create one</a>
              </span>
              <div style={{ marginTop: 6 }}>
                <a style={styles.link} onClick={() => setMode("forgot")}>Forgot password?</a>
              </div>
            </>
          )}
          {mode === "register" && (
            <span>
              Already have an account?{" "}
              <a style={styles.link} onClick={() => setMode("login")}>Sign in</a>
            </span>
          )}
          {(mode === "forgot" || mode === "reset") && (
            <span>
              <a style={styles.link} onClick={() => setMode("login")}>Back to sign in</a>
            </span>
          )}
        </div>

        {mode === "login" && (
          <div style={styles.hint}>
            Demo login (after running <code>npm run seed</code> on the backend):
            <br />
            <code>jister@example.com</code> / <code>password123</code>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#F6F2E9",
    fontFamily: "'Inter', sans-serif",
  },
  card: {
    width: 360,
    background: "#fff",
    borderRadius: 14,
    padding: "32px 28px",
    boxShadow: "0 4px 24px rgba(27,27,31,0.08)",
    border: "1px solid #E4DFD3",
  },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 9,
    background: "linear-gradient(135deg, #C9A227, #E3C25C)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Fraunces', serif",
    fontWeight: 700,
    color: "#1B1B1F",
    marginBottom: 14,
  },
  title: {
    fontFamily: "'Fraunces', serif",
    fontSize: 22,
    margin: "0 0 4px",
  },
  subtitle: { fontSize: 13, color: "#8B8680", margin: "0 0 20px" },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #E4DFD3",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 13.5,
    marginBottom: 10,
    outline: "none",
  },
  button: {
    width: "100%",
    background: "#1F6F78",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "11px 0",
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
    marginTop: 4,
  },
  error: { color: "#9C4221", fontSize: 12.5, marginBottom: 10 },
  info: { color: "#3F7D52", fontSize: 12.5, marginBottom: 10 },
  switchRow: { textAlign: "center", fontSize: 12.5, marginTop: 16, color: "#5C5747" },
  link: { color: "#1F6F78", fontWeight: 600, cursor: "pointer" },
  hint: {
    marginTop: 18,
    fontSize: 11,
    color: "#8B8680",
    background: "#F6F2E9",
    borderRadius: 8,
    padding: "8px 10px",
    lineHeight: 1.5,
  },
};
