"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";

type LogEntry = {
  ip?: string;
  path?: string;
  payload?: string;
  time: string;
};

export default function ProtectedPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    // Only access window APIs inside useEffect (client-side only)
    const fetchAttack = async () => {
      try {
        const res = await fetch("/api/monitor");
        const data = await res.json();
        if (data?.attack) {
          setLogs((prev) => [
            { ...data.attack, time: data.timestamp },
            ...prev.slice(0, 9),
          ]);
        }
      } catch (err) {
        console.log(err);
      }
    };

    fetchAttack();
    const interval = setInterval(fetchAttack, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Log visit — safely access window only on client
    if (typeof window === "undefined") return;

    const payload = window.location.search;
    fetch("/api/monitor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ip: "LIVE_USER",
        path: "/protected",
        payload,
      }),
    }).catch(console.log);
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#060b18" }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: "32px 28px" }}>
        {/* Header */}
        <div style={{
          fontFamily: "'Orbitron', monospace",
          fontSize: "0.85rem", fontWeight: 700,
          color: "#00FF9C", letterSpacing: "0.15em",
          marginBottom: 8,
        }}>THREAT MONITOR</div>
        <div style={{
          fontSize: "0.7rem", color: "rgba(255,255,255,0.3)",
          fontFamily: "'Courier New', monospace", marginBottom: 28,
        }}>Live attack detection and intrusion monitoring</div>

        {/* Attack Log Table */}
        <div style={{
          background: "#0a1128",
          border: "1px solid rgba(0,255,156,0.08)",
          borderRadius: 10, padding: "18px 22px",
        }}>
          <div style={{
            fontFamily: "'Orbitron', monospace", fontSize: "0.6rem",
            color: "rgba(255,255,255,0.35)", letterSpacing: "0.15em",
            marginBottom: 14,
          }}>INCOMING REQUESTS</div>

          {logs.length === 0 ? (
            <div style={{
              color: "rgba(255,255,255,0.2)", fontSize: "0.72rem",
              fontFamily: "'Courier New', monospace", padding: "20px 0",
              textAlign: "center",
            }}>
              Monitoring... No suspicious activity detected.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {logs.map((log, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "8px 12px",
                  background: "rgba(255,255,255,0.02)",
                  borderRadius: 6, fontSize: "0.68rem",
                  fontFamily: "'Courier New', monospace",
                }}>
                  <span style={{ color: "rgba(255,255,255,0.2)", minWidth: 70 }}>
                    {new Date(log.time).toLocaleTimeString()}
                  </span>
                  <span style={{ color: "#f87171", minWidth: 90 }}>{log.ip || "unknown"}</span>
                  <span style={{ color: "#facc15" }}>{log.path || "/"}</span>
                  {log.payload && (
                    <span style={{ color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>
                      {log.payload.substring(0, 60)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');`}</style>
    </div>
  );
}
