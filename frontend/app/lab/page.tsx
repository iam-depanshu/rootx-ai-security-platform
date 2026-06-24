"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import dynamic from "next/dynamic";

const SandboxTerminal = dynamic(() => import("@/components/SandboxTerminal"), { ssr: false });

export default function LabPage() {
  const [sessionId] = useState(() => "sandbox-" + Math.random().toString(36).slice(2, 10));
  const [labUrl, setLabUrl] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const startLab = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/lab/start", {
        method: "POST",
        body: JSON.stringify({ templateName: "juice-shop", sessionId }),
      });
      const data = await res.json();
      setLabUrl(data.accessUrl);
    } catch {
      alert("Failed to start lab. Is Docker running?");
    }
    setStarting(false);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--background)" }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: "32px 28px", maxWidth: 900 }}>
        <div style={{ fontFamily: "var(--font-logo)", fontSize: "0.85rem", fontWeight: 700, color: "var(--accent)", letterSpacing: "0.15em", marginBottom: 8 }}>
          SANDBOX LAB
        </div>
        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 24 }}>
          Start a vulnerable target container and get a live Kali terminal to attack it
        </div>

        {/* Kali Terminal */}
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 10 }}>
            KALI TERMINAL — session: {sessionId}
          </div>
          <SandboxTerminal sessionId={sessionId} />
        </div>

        {/* Lab Controls */}
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "20px 24px", marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--font-logo)", fontSize: "0.6rem", color: "var(--text-muted)", letterSpacing: "0.15em", marginBottom: 12 }}>
            VULNERABLE TARGETS
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={startLab}
              disabled={starting}
              style={{
                padding: "12px 24px", borderRadius: 8,
                background: starting ? "rgba(var(--accent-rgb),0.1)" : "var(--accent)",
                color: starting ? "var(--accent)" : "var(--background)",
                border: starting ? "1px solid var(--accent)" : "none",
                fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                fontWeight: 700, cursor: starting ? "not-allowed" : "pointer",
              }}
            >
              {starting ? "Starting..." : "Start Juice Shop"}
            </button>
          </div>
          {labUrl && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(0,255,156,0.06)", border: "1px solid rgba(0,255,156,0.2)", borderRadius: 6 }}>
              <div style={{ fontSize: "0.6rem", color: "#00FF9C", fontFamily: "var(--font-mono)", marginBottom: 4 }}>LAB READY</div>
              <a href={labUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
                {labUrl}
              </a>
            </div>
          )}
        </div>

        <style>{`
          .xterm { height: 100%; }
          .xterm-viewport { scrollbar-width: thin; }
        `}</style>
      </div>
    </div>
  );
}
