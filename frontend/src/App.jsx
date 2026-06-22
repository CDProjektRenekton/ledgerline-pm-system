import React, { useEffect, useState } from "react";
import Login from "./Login.jsx";
import Dashboard from "./Dashboard.jsx";
import { api, getStoredToken, setToken } from "./api";

export default function App() {
  const [auth, setAuth] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get("reset_token");
  const verifyToken = params.get("verify_token");

  useEffect(() => {
    // Email verification takes priority — handle it before anything else
    if (verifyToken) {
      api.verifyEmail(verifyToken)
        .then(() => {
          window.history.replaceState({}, "", window.location.pathname);
        })
        .catch(() => {})
        .finally(() => setCheckingSession(false));
      return;
    }
    if (resetToken) {
      setCheckingSession(false);
      return;
    }
    const token = getStoredToken();
    if (!token) {
      setCheckingSession(false);
      return;
    }
    api.me(token)
      .then(({ user }) => setAuth({ token, user }))
      .catch(() => setToken(null))
      .finally(() => setCheckingSession(false));
  }, []);

  const handleAuthed = (token, user) => {
    setAuth({ token, user });
    window.history.replaceState({}, "", window.location.pathname);
  };
  const handleLogout = () => { setToken(null); setAuth(null); };

  if (checkingSession) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: "#8B8680" }}>
        {verifyToken ? "Verifying your email…" : "Restoring session…"}
      </div>
    );
  }

  if (resetToken && !auth) return <Login onAuthed={handleAuthed} resetToken={resetToken} />;
  if (!auth) return <Login onAuthed={handleAuthed} verifyToken={verifyToken} />;
  return <Dashboard token={auth.token} user={auth.user} onLogout={handleLogout} />;
}
