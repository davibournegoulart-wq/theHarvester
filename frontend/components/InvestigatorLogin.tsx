"use client";

import { useEffect, useState } from "react";

export default function InvestigatorLogin() {
  const [name, setName] = useState("");
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("investigator_name");
    if (saved) {
      setName(saved);
      setLogged(true);
    }
  }, []);

  function handleLogin() {
    if (!name.trim()) return;
    localStorage.setItem("investigator_name", name);
    setLogged(true);
    // Reload to apply globally
    window.location.reload();
  }

  function handleLogout() {
    localStorage.removeItem("investigator_name");
    setLogged(false);
    setName("");
    window.location.reload();
  }

  if (logged) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(5,217,232,0.1)", padding: "4px 12px", borderRadius: 4, border: "1px solid var(--cyan)" }}>
        <span style={{ fontSize: 13, color: "var(--cyan)" }}>Agent: <strong>{name}</strong></span>
        <button onClick={handleLogout} style={{ fontSize: 10, padding: "2px 6px", background: "transparent", border: "1px solid var(--panel-border)" }}>Log Out</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input 
        value={name} 
        onChange={(e) => setName(e.target.value)} 
        placeholder="Agent ID" 
        style={{ fontSize: 12, padding: "4px 8px" }}
      />
      <button onClick={handleLogin} style={{ fontSize: 12, padding: "4px 8px" }}>Log In</button>
    </div>
  );
}
