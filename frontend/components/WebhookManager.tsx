"use client";

import React, { useState, useEffect } from "react";
import { apiGet, apiPostJson, apiFetch } from "@/lib/api";
import { TerminalIcon, CheckIcon, CrossIcon } from "@/components/FlatIcons";

type WebhookItem = {
  id: string;
  name: string;
  url: string;
  full_url: string;
  platform: string;
  events: string[];
  is_active: boolean;
  created_at: string | null;
  last_triggered_at: string | null;
  last_status: string | null;
};

export default function WebhookManager({ onClose }: { onClose?: () => void }) {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState("discord");
  const [events, setEvents] = useState<string[]>([
    "evidence_added",
    "target_alert",
    "spider_match",
    "case_created",
  ]);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function loadWebhooks() {
    setLoading(true);
    try {
      const data = await apiGet<WebhookItem[]>("/alerts/webhooks");
      setWebhooks(data || []);
    } catch (err) {
      console.error("Failed to load webhooks:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWebhooks();
  }, []);

  function toggleEvent(evt: string) {
    if (events.includes(evt)) {
      setEvents(events.filter((e) => e !== evt));
    } else {
      setEvents([...events, evt]);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !url.trim()) {
      alert("Name and URL are required.");
      return;
    }

    try {
      await apiPostJson("/alerts/webhooks", {
        name: name.trim(),
        url: url.trim(),
        platform,
        events,
      });
      setName("");
      setUrl("");
      setFeedback("Webhook registered successfully!");
      setTimeout(() => setFeedback(null), 3000);
      loadWebhooks();
    } catch (err: any) {
      alert(err?.message || "Failed to create webhook");
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      const res = await apiPostJson<{ status: string; results: any[] }>(`/alerts/webhooks/${id}/test`, {});
      setFeedback(`Test payload dispatched (${res.results?.[0]?.status || "OK"}). Check your channel.`);
      setTimeout(() => setFeedback(null), 4000);
      loadWebhooks();
    } catch (err: any) {
      alert(err?.message || "Test ping failed");
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this alerting webhook?")) return;
    try {
      await apiFetch(`/alerts/webhooks/${id}`, { method: "DELETE" });
      loadWebhooks();
    } catch (err: any) {
      alert(err?.message || "Failed to delete webhook");
    }
  }

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
            {"> REAL-TIME DISPATCH SUBSYSTEM // DISCORD • TELEGRAM • SLACK • WEBHOOKS_"}
          </div>
          <h2 style={{ margin: 0, fontSize: 24, letterSpacing: "0.12em", display: "flex", alignItems: "center", gap: 10 }}>
            <TerminalIcon size={22} color="var(--cyan)" />
            AUTOMATED CASE ALERTING & WEBHOOKS
          </h2>
          <p style={{ margin: "6px 0 0 0", color: "var(--text-muted)", fontSize: 13, maxWidth: 650 }}>
            Real-time tactical webhook alerts. Sends structured alerts directly to Discord channels, Telegram bots, or custom SIEM webhooks whenever new target evidence or dark web matches are discovered.
          </p>
        </div>

        {feedback && (
          <div
            style={{
              padding: "8px 16px",
              background: "rgba(0, 255, 159, 0.15)",
              border: "1px solid #00FF9F",
              borderRadius: 8,
              color: "#00FF9F",
              fontSize: 12,
              fontWeight: "bold",
            }}
          >
            {feedback}
          </div>
        )}
      </div>

      {/* Creation Form */}
      <div className="hud-glass" style={{ padding: 20, borderRadius: 12 }}>
        <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", marginBottom: 12, letterSpacing: "0.1em" }}>
          REGISTER NEW ALERT CHANNEL
        </div>

        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "180px 200px 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>PLATFORM PRESET</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                style={{ width: "100%", padding: 8, background: "#0c0e17", border: "1px solid var(--panel-border)", color: "#fff", borderRadius: 6 }}
              >
                <option value="discord">Discord Webhook</option>
                <option value="telegram">Telegram Bot Endpoint</option>
                <option value="slack">Slack Webhook</option>
                <option value="generic">Generic REST JSON</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>CHANNEL NAME</label>
              <input
                type="text"
                placeholder="e.g. #soc-intel-feed"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: "100%", padding: 8, background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)", color: "#fff", borderRadius: 6 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>WEBHOOK URL</label>
              <input
                type="text"
                placeholder={
                  platform === "discord"
                    ? "https://discord.com/api/webhooks/..."
                    : platform === "telegram"
                    ? "https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<ID>"
                    : "https://your-api.com/webhook"
                }
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{ width: "100%", padding: 8, background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)", color: "#fff", borderRadius: 6, fontFamily: "monospace" }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>SUBSCRIBED EVENTS</label>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {[
                { id: "evidence_added", label: "New Evidence Attached" },
                { id: "target_alert", label: "Target Watchdog Findings" },
                { id: "spider_match", label: "Dark Web Spider Matches" },
                { id: "case_created", label: "New Investigation Case Opened" },
              ].map((ev) => (
                <label key={ev.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#fff", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={events.includes(ev.id)}
                    onChange={() => toggleEvent(ev.id)}
                  />
                  {ev.label}
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            style={{
              alignSelf: "flex-start",
              padding: "10px 20px",
              background: "rgba(5, 217, 232, 0.15)",
              borderColor: "var(--cyan)",
              color: "var(--cyan)",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            + REGISTER ALERT ENDPOINT
          </button>
        </form>
      </div>

      {/* Existing Webhooks List */}
      <div className="hud-glass" style={{ padding: 24, borderRadius: 12 }}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: 18, color: "var(--cyan)", letterSpacing: "0.1em" }}>
          ACTIVE CHANNELS ({webhooks.length})
        </h3>

        {webhooks.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", border: "1px dashed var(--panel-border)", borderRadius: 8 }}>
            No webhooks configured. Register a Discord or Telegram endpoint above to receive live notifications.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {webhooks.map((w) => (
              <div
                key={w.id}
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
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(5, 217, 232, 0.15)", color: "var(--cyan)", fontFamily: "monospace", textTransform: "uppercase" }}>
                      {w.platform}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>{w.name}</span>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-muted)" }}>{w.url}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    Events: {w.events.join(", ")}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ textAlign: "right", fontSize: 10, color: "var(--text-muted)" }}>
                    <div>STATUS: <strong style={{ color: w.last_status?.startsWith("HTTP_2") ? "#00FF9F" : "var(--cyan)" }}>{w.last_status || "READY"}</strong></div>
                    <div>{w.last_triggered_at ? `Last sent: ${new Date(w.last_triggered_at).toLocaleTimeString()}` : "No dispatches yet"}</div>
                  </div>

                  <button
                    onClick={() => handleTest(w.id)}
                    disabled={testingId === w.id}
                    style={{
                      padding: "6px 12px",
                      fontSize: 11,
                      background: "rgba(0, 255, 159, 0.12)",
                      borderColor: "#00FF9F",
                      color: "#00FF9F",
                      fontWeight: "bold",
                      cursor: testingId === w.id ? "wait" : "pointer",
                    }}
                  >
                    {testingId === w.id ? "SENDING..." : "TEST PING ⚡"}
                  </button>

                  <button
                    onClick={() => handleDelete(w.id)}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
