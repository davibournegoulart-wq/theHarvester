"use client";

import React, { useState, useEffect } from "react";
import { apiGet, apiPostJson, apiFetch } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import { RadarIcon, UserIcon, GlobeIcon, BoltIcon, ShieldIcon, CheckIcon, CrossIcon } from "@/components/FlatIcons";

type Monitor = {
  id: string;
  case_id: string;
  target_type: string;
  target_value: string;
  interval_minutes: number;
  status: string;
  findings_count: number;
  last_findings_summary: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  is_active: boolean;
  created_at: string;
};

export default function TargetWatchdog() {
  const { activeCase } = useActiveCase();
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetType, setTargetType] = useState<string>("username");
  const [targetValue, setTargetValue] = useState<string>("");
  const [intervalMinutes, setIntervalMinutes] = useState<number>(60);
  const [runningId, setRunningId] = useState<string | null>(null);

  async function loadMonitors() {
    setLoading(true);
    try {
      const data = await apiGet<Monitor[]>("/monitors");
      setMonitors(data || []);
    } catch (err) {
      console.error("Failed to load monitors:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMonitors();
    const interval = setInterval(loadMonitors, 15000);
    return () => clearInterval(interval);
  }, []);

  async function handleCreateMonitor(e: React.FormEvent) {
    e.preventDefault();
    if (!targetValue.trim()) {
      alert("Please enter a target identifier.");
      return;
    }
    if (!activeCase) {
      alert("Please select or create an active case in the top HUD before scheduling a monitor.");
      return;
    }

    try {
      await apiPostJson("/monitors", {
        case_id: activeCase.id,
        target_type: targetType,
        target_value: targetValue.trim(),
        interval_minutes: intervalMinutes,
      });
      setTargetValue("");
      loadMonitors();
    } catch (err: any) {
      alert(err?.message || "Failed to schedule monitor");
    }
  }

  async function handleRunNow(id: string) {
    setRunningId(id);
    try {
      await apiPostJson(`/monitors/${id}/run-now`, {});
      await loadMonitors();
    } catch (err: any) {
      alert(err?.message || "Failed to trigger monitor run");
    } finally {
      setRunningId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this scheduled target monitor?")) return;
    try {
      await apiFetch(`/monitors/${id}`, { method: "DELETE" });
      loadMonitors();
    } catch (err: any) {
      alert(err?.message || "Failed to delete monitor");
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "username":
        return <UserIcon size={14} color="#FFB800" />;
      case "domain":
        return <GlobeIcon size={14} color="var(--cyan)" />;
      case "crypto":
        return <BoltIcon size={14} color="#FF2A6D" />;
      case "onion":
        return <ShieldIcon size={14} color="#A259FF" />;
      default:
        return <RadarIcon size={14} color="#00FF9F" />;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div
        className="hud-glass"
        style={{
          padding: 24,
          borderRadius: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "var(--cyan)", fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: 4 }}>
            {"> AUTOMATED SCHEDULER // PERSISTENT TARGET RE-SCRAPER & DRIFT DETECTOR_"}
          </div>
          <h2 style={{ margin: 0, fontSize: 24, letterSpacing: "0.12em", display: "flex", alignItems: "center", gap: 10 }}>
            <RadarIcon size={22} color="var(--cyan)" />
            TARGET WATCHDOG & SCHEDULER
          </h2>
          <p style={{ margin: "6px 0 0 0", color: "var(--text-muted)", fontSize: 13, maxWidth: 650 }}>
            Automated continuous reconnaissance daemon. Re-scrapes handles, domains, crypto addresses, and dark web services on background intervals (hourly, 6h, daily) and dispatches alerts on new findings.
          </p>
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div
            style={{
              padding: "8px 16px",
              background: "rgba(0, 255, 159, 0.08)",
              border: "1px solid #00FF9F",
              borderRadius: 8,
              textAlign: "right",
            }}
          >
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>DAEMON WORKER</div>
            <div style={{ fontSize: 14, color: "#00FF9F", fontWeight: "bold" }}>ACTIVE // 60s HEARTBEAT</div>
          </div>
          <div
            style={{
              padding: "8px 16px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid var(--panel-border)",
              borderRadius: 8,
              textAlign: "right",
            }}
          >
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>SCHEDULED MONITORS</div>
            <div style={{ fontSize: 14, color: "var(--cyan)", fontWeight: "bold" }}>{monitors.length} TARGETS</div>
          </div>
        </div>
      </div>

      {/* Schedule Form */}
      <div className="hud-glass" style={{ padding: 20, borderRadius: 12 }}>
        <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", marginBottom: 12, letterSpacing: "0.1em" }}>
          SCHEDULE NEW TARGET MONITOR
        </div>

        <form onSubmit={handleCreateMonitor} style={{ display: "grid", gridTemplateColumns: "160px 1fr 180px 180px", gap: 12, alignItems: "center" }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>TARGET TYPE</label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              style={{ width: "100%", padding: 8, background: "#0c0e17", border: "1px solid var(--panel-border)", color: "#fff", borderRadius: 6 }}
            >
              <option value="username">Username / Handle</option>
              <option value="domain">Domain / Web Host</option>
              <option value="crypto">Crypto Wallet</option>
              <option value="onion">Tor Onion Service</option>
              <option value="social">Social Media Feed</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>IDENTIFIER / URL / WALLET</label>
            <input
              type="text"
              placeholder="e.g. shadow_broker, leaksite.onion, 0x71c... or domain.com"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              style={{ width: "100%", padding: 8, background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)", color: "#fff", borderRadius: 6, fontFamily: "monospace" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>INTERVAL FREQUENCY</label>
            <select
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Number(e.target.value))}
              style={{ width: "100%", padding: 8, background: "#0c0e17", border: "1px solid var(--panel-border)", color: "#fff", borderRadius: 6 }}
            >
              <option value={15}>Every 15 Minutes</option>
              <option value={60}>Every 1 Hour (Standard)</option>
              <option value={360}>Every 6 Hours</option>
              <option value={1440}>Every 24 Hours (Daily)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>ACTION</label>
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "8px 14px",
                background: "rgba(0, 255, 159, 0.15)",
                borderColor: "#00FF9F",
                color: "#00FF9F",
                fontWeight: "bold",
                cursor: "pointer",
                height: 38,
              }}
            >
              + ADD WATCHDOG
            </button>
          </div>
        </form>

        <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
          Linked Case: <strong style={{ color: activeCase ? "var(--cyan)" : "#FF2A6D" }}>{activeCase ? activeCase.name : "No Case Active (Select in HUD)"}</strong>
        </div>
      </div>

      {/* Monitors Table */}
      <div className="hud-glass" style={{ padding: 24, borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: "var(--cyan)", letterSpacing: "0.1em" }}>
            ACTIVE WATCHDOG JOBS ({monitors.length})
          </h3>
          <button
            onClick={loadMonitors}
            style={{ padding: "6px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--panel-border)", color: "var(--text-muted)", fontSize: 11 }}
          >
            Refresh Telemetry
          </button>
        </div>

        {monitors.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", border: "1px dashed var(--panel-border)", borderRadius: 8 }}>
            No target watchdogs scheduled. Add a target above to initiate persistent automated reconnaissance.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {monitors.map((m) => {
              const isRunning = runningId === m.id;
              return (
                <div
                  key={m.id}
                  style={{
                    padding: "14px 18px",
                    background: "rgba(10, 14, 24, 0.6)",
                    border: "1px solid var(--panel-border)",
                    borderRadius: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 350px" }}>
                    <div style={{ padding: 8, background: "rgba(255,255,255,0.04)", borderRadius: 6, display: "flex", alignItems: "center" }}>
                      {getTypeIcon(m.target_type)}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(5, 217, 232, 0.1)", color: "var(--cyan)", fontFamily: "monospace", textTransform: "uppercase" }}>
                          {m.target_type}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: "bold", fontFamily: "monospace", color: "#fff" }}>
                          {m.target_value}
                        </span>
                        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(0, 255, 159, 0.1)", color: "#00FF9F" }}>
                          {m.interval_minutes >= 60 ? `${m.interval_minutes / 60}h interval` : `${m.interval_minutes}m interval`}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                        {m.last_findings_summary || "Awaiting first scheduled execution cycle."}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                        FINDINGS: <strong style={{ color: "#00FF9F" }}>{m.findings_count}</strong>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        {m.last_run_at ? `Scanned: ${new Date(m.last_run_at).toLocaleTimeString()}` : "Never run"}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleRunNow(m.id)}
                        disabled={isRunning}
                        style={{
                          padding: "6px 12px",
                          fontSize: 11,
                          background: isRunning ? "rgba(255, 184, 0, 0.2)" : "rgba(5, 217, 232, 0.12)",
                          borderColor: isRunning ? "#FFB800" : "var(--cyan)",
                          color: isRunning ? "#FFB800" : "var(--cyan)",
                          fontWeight: "bold",
                          cursor: isRunning ? "wait" : "pointer",
                        }}
                      >
                        {isRunning ? "SCANNING..." : "RUN NOW ⚡"}
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        style={{
                          padding: "6px 10px",
                          fontSize: 11,
                          borderColor: "var(--danger)",
                          color: "var(--danger)",
                          background: "rgba(255,0,0,0.06)",
                          cursor: "pointer",
                        }}
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
