import React, { useEffect, useState } from "react";
import Login from "./Login.jsx";
import Dashboard from "./Dashboard.jsx";
import { api, getStoredToken, setToken } from "./api";

export default function App() {
  const [auth, setAuth] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // On first load, if a token is stored, verify it and restore the user.
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setCheckingSession(false);
      return;
    }
    api
      .me(token)
      .then(({ user }) => setAuth({ token, user }))
      .catch(() => setToken(null))
      .finally(() => setCheckingSession(false));
  }, []);

  const handleAuthed = (token, user) => setAuth({ token, user });
  const handleLogout = () => {
    setToken(null);
    setAuth(null);
  };

  if (checkingSession) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: "#8B8680" }}>
        Restoring session…
      </div>
    );
  }

  if (!auth) {
    return <Login onAuthed={handleAuthed} />;
  }

  return <Dashboard token={auth.token} user={auth.user} onLogout={handleLogout} />;
}
