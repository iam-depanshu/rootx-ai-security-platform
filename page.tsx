"use client";
import { supabase } from "@/lib/supabase";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Slidebar from "@/components/Slidebar";
import Navbar from "@/components/Navbar";
import SecurityCard from "@/components/SecurityCard";
import ScannerEngine from "@/components/scannerengine";
import activityFeed from "@/components/ActivityFeed";
/* ─── TYPES ─── */
type Vuln = { name: string; severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; detail: string };
type ScanResult = { score: number; status: string; vulnerabilities: Vuln[]; technologies?: string[] };
type LogLine = { id: number; type: string; msg: string };

/* ─── MOCK SCAN ENGINE (replace with real API later) ─── */
const MOCK_STAGES = [
  { type: "INFO",  msg: "Initializing RootX scan engine v2.4..." },
  { type: "INFO",  msg: "Resolving target hostname..." },
  { type: "INFO",  msg: "Starting Nmap port discovery..." },
  { type: "WARN",  msg: "Port 8080 open — unencrypted HTTP detected" },
  { type: "WARN",  msg: "Port 22 open — SSH exposed to public" },
  { type: "INFO",  msg: "Launching OWASP ZAP active scan..." },
  { type: "CRIT",  msg: "SQL Injection found at /api/login?id= parameter" },
  { type: "CRIT",  msg: "Reflected XSS detected on /search?q= endpoint" },
  { type: "WARN",  msg: "Missing Content-Security-Policy header" },
  { type: "WARN",  msg: "X-Frame-Options header not set — clickjacking risk" },
  { type: "OK",    msg: "SSL/TLS configuration: PASSED" },
  { type: "INFO",  msg: "Running AI analysis on findings..." },
  { type: "OK",    msg: "Scan complete. Generating security report..." },
];

const MOCK_RESULT: ScanResult = {
  score: 42,
  status: "CRITICAL",
  vulnerabilities: [
    { name: "SQL Injection",           severity: "CRITICAL", detail: "Parameter id= on /api/login is unsanitized" },
    { name: "Cross-Site Scripting",    severity: "CRITICAL", detail: "Reflected XSS on /search?q= endpoint" },
    { name: "Open Port 8080",          severity: "HIGH",     detail: "Unencrypted HTTP running on port 8080" },
    { name: "SSH Publicly Exposed",    severity: "HIGH",     detail: "Port 22 accessible from internet" },
    { name: "Missing CSP Header",      severity: "MEDIUM",   detail: "No Content-Security-Policy header found" },
    { name: "Clickjacking Risk",       severity: "MEDIUM",   detail: "X-Frame-Options header not configured" },
    { name: "SSL Cert Expires Soon",   severity: "LOW",      detail: "Certificate expires in 18 days" },
  ],
};

/* ─── SEVERITY CONFIG ─── */
const SEV: Record<string, { color: string; bg: string; icon: string }> = {
  CRITICAL: { color: "#f87171", bg: "rgba(248,113,113,0.1)",  icon: "☠" },
  HIGH:     { color: "#fb923c", bg: "rgba(251,146,60,0.1)",   icon: "⚠" },
  MEDIUM:   { color: "#facc15", bg: "rgba(250,204,21,0.1)",   icon: "◎" },
  LOW:      { color: "#22d3ee", bg: "rgba(34,211,238,0.1)",   icon: "▸" },
};

const LOG_COLOR: Record<string, string> = {
  CRIT: "#f87171", WARN: "#facc15", INFO: "#22d3ee", OK: "#00FF9C",
};

/* ─── SCORE RING ─── */
function ScoreRing({ score, visible }: { score: number; visible: boolean }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const fill = circ * (score / 100);
  const color = score >= 70 ? "#00FF9C" : score >= 40 ? "#facc15" : "#f87171";
  const label = score >= 70 ? "SECURE" : score >= 40 ? "MODERATE" : "CRITICAL";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none"
          stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <motion.circle
          cx="65" cy="65" r={r} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${circ}`} strokeDashoffset={circ}
          animate={visible ? { strokeDashoffset: circ - fill } : { strokeDashoffset: circ }}
          transition={{ duration: 2, ease: "easeOut" }}
          transform="rotate(-90 65 65)"
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
        <text x="65" y="61" textAnchor="middle" fill={color}
          style={{ fontFamily: "'Orbitron',monospace", fontSize: 28, fontWeight: 900 }}>
          {score}
        </text>
        <text x="65" y="76" textAnchor="middle" fill="rgba(255,255,255,0.3)"
          style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: 3 }}>
          /100
        </text>
      </svg>
      <span style={{
        fontFamily: "monospace", fontSize: "0.65rem",
        letterSpacing: "0.2em", color,
        textShadow: `0 0 10px ${color}`,
      }}>{label}</span>
    </div>
  );
}

/* ─── MAIN COMPONENT ─── */
export default function Dashboard() {
  const [target, setTarget]         = useState("");
  const [scanning, setScanning]     = useState(false);
  const [done, setDone]             = useState(false);
  const [logs, setLogs]             = useState<LogLine[]>([]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [progress, setProgress]     = useState(0);
  const [stageLabel, setStageLabel] = useState("");
  const [activeVuln, setActiveVuln] = useState<Vuln | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const [scans, setScans] = useState<any[]>([]);
  useEffect(() => {
  fetchScans();
}, []);

const fetchScans = async () => {

  const { data, error } = await supabase
    .from("scans")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  if (data) {
    setScans(data);
  }

  if (error) {
    console.log(error);
  }

};

  /* auto-scroll logs */
  useEffect(() => {
    if (logRef.current)
      logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  /* ── START SCAN ── */
  const handleScan = async () => {
    if (!target.trim() || scanning) return;
    setScanning(true);
    setDone(false);
    setScanResult(null);
    setLogs([]);
    setProgress(0);

    /* Replay mock log lines with staggered delay */
    for (let i = 0; i < MOCK_STAGES.length; i++) {
      await sleep(600 + Math.random() * 400);
      const s = MOCK_STAGES[i];
      setLogs((prev) => [
        ...prev,
        { id: i, type: s.type, msg: s.msg },
      ]);
      setStageLabel(s.msg);
      setProgress(Math.round(((i + 1) / MOCK_STAGES.length) * 100));
    }

    /* In real app: call your Express API here
       const res  = await fetch("/api/scan", { method:"POST", ... });
       const data = await res.json();
       setScanResult(data);
    */
    try {

  const response = await fetch("/api/scan", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      target,
    }),
  });

  const data = await response.json();

  setScanResult(data);

} catch (error) {

  setLogs((prev) => [
    ...prev,
    {
      id: Date.now(),
      type: "CRIT",
      msg: "RootX backend scan failed.",
    },
  ]);

}
    setScanning(false);
    setDone(true);
  };

  const reset = () => {
    setDone(false); setScanResult(null);
    setLogs([]); setProgress(0); setTarget("");
  };

  return (
    <><div className="mt-10 space-y-4">

          {scans.map((scan) => (

              <div
                  key={scan.id}
                  className="border p-4 rounded-lg"
              >

                  <h2 className="text-xl font-bold">
                      {scan.target}
                  </h2>

                  <p>
                      Score: {scan.score}
                  </p>

                  <p>
                      Status: {scan.status}
                  </p>

                  <p>
                      SSL: {scan.ssl_grade}
                  </p>

              </div>

          ))}

      </div><>
              <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');

        .scanner-wrap {
          background: #050816;
          min-height: 100vh;
          padding: 32px;
          background-image:
            linear-gradient(rgba(0,255,156,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,156,0.025) 1px, transparent 1px);
          background-size: 60px 60px;
          color: #fff;
          font-family: 'Courier New', monospace;
        }

        .page-heading {
          font-family: 'Orbitron', monospace;
          font-size: clamp(1.4rem, 3vw, 2rem);
          font-weight: 900;
          color: #00FF9C;
          letter-spacing: 0.1em;
          text-shadow: 0 0 24px rgba(0,255,156,0.5);
          margin-bottom: 4px;
        }

        .page-sub {
          font-size: 0.65rem;
          letter-spacing: 0.25em;
          color: rgba(255,255,255,0.25);
          margin-bottom: 32px;
          display: block;
        }

        /* ── INPUT PANEL ── */
        .input-panel {
          background: #080d1e;
          border: 1px solid rgba(0,255,156,0.15);
          border-radius: 6px;
          padding: 28px;
          margin-bottom: 24px;
          position: relative;
          overflow: hidden;
        }

        .input-panel::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0,255,156,0.5), transparent);
        }

        .input-panel::after {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 3px; height: 100%;
          background: #00FF9C;
          box-shadow: 0 0 12px rgba(0,255,156,0.8);
        }

        .input-label {
          font-size: 0.62rem;
          letter-spacing: 0.22em;
          color: rgba(0,255,156,0.6);
          display: block;
          margin-bottom: 10px;
        }

        .scan-input-row {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .scan-input {
          flex: 1;
          background: rgba(0,0,0,0.5);
          border: 1px solid rgba(0,255,156,0.2);
          border-radius: 4px;
          padding: 13px 16px;
          color: #00FF9C;
          font-family: 'Courier New', monospace;
          font-size: 0.85rem;
          letter-spacing: 0.05em;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .scan-input::placeholder { color: rgba(0,255,156,0.25); }

        .scan-input:focus {
          border-color: rgba(0,255,156,0.6);
          box-shadow: 0 0 16px rgba(0,255,156,0.12);
        }

        .scan-btn {
          font-family: 'Orbitron', monospace;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: #050816;
          background: #00FF9C;
          border: none;
          border-radius: 4px;
          padding: 13px 28px;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .scan-btn:hover:not(:disabled) {
          background: #fff;
          box-shadow: 0 0 28px rgba(0,255,156,0.6);
        }

        .scan-btn:disabled {
          background: rgba(0,255,156,0.2);
          color: rgba(0,255,156,0.5);
          cursor: not-allowed;
        }

        .reset-btn {
          font-family: 'Orbitron', monospace;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #00FF9C;
          background: transparent;
          border: 1px solid rgba(0,255,156,0.3);
          border-radius: 4px;
          padding: 12px 20px;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .reset-btn:hover { background: rgba(0,255,156,0.08); }

        /* ── PROGRESS ── */
        .progress-wrap {
          margin-top: 20px;
        }

        .progress-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
          font-size: 0.6rem;
          letter-spacing: 0.1em;
          color: rgba(255,255,255,0.3);
        }

        .progress-track {
          width: 100%;
          height: 4px;
          background: rgba(255,255,255,0.06);
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #00FF9C, #22d3ee);
          border-radius: 2px;
          transition: width 0.4s ease;
          box-shadow: 0 0 10px rgba(0,255,156,0.6);
        }

        .stage-label {
          margin-top: 8px;
          font-size: 0.6rem;
          letter-spacing: 0.08em;
          color: rgba(255,255,255,0.25);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ── TERMINAL ── */
        .terminal-panel {
          background: #020509;
          border: 1px solid rgba(0,255,156,0.12);
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 24px;
        }

        .terminal-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: #080d1e;
          border-bottom: 1px solid rgba(0,255,156,0.1);
        }

        .t-dot { width: 10px; height: 10px; border-radius: 50%; }

        .terminal-bar-title {
          margin-left: 8px;
          font-size: 0.65rem;
          letter-spacing: 0.12em;
          color: rgba(255,255,255,0.25);
        }

        .terminal-body {
          padding: 16px;
          height: 220px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 4px;
          scrollbar-width: thin;
          scrollbar-color: rgba(0,255,156,0.2) transparent;
        }

        .log-line {
          display: flex;
          gap: 10px;
          font-size: 0.68rem;
          letter-spacing: 0.04em;
          line-height: 1.6;
        }

        .log-tag {
          flex-shrink: 0;
          min-width: 42px;
          font-weight: bold;
        }

        .log-msg { color: rgba(255,255,255,0.45); }

        .terminal-cursor {
          display: inline-block;
          width: 8px; height: 14px;
          background: #00FF9C;
          animation: cur-blink 1s step-end infinite;
          vertical-align: middle;
          margin-left: 4px;
        }

        @keyframes cur-blink { 50% { opacity: 0; } }

        /* ── RESULTS GRID ── */
        .results-grid {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 24px;
          background: #080d1e;
          border: 1px solid rgba(0,255,156,0.15);
          border-radius: 6px;
          padding: 24px;
          margin-bottom: 24px;
          position: relative;
          overflow: hidden;
        }

        .results-grid::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0,255,156,0.5), transparent);
        }

        .result-meta { display: flex; flex-direction: column; justify-content: center; gap: 12px; }

        .rm-title {
          font-family: 'Orbitron', monospace;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: rgba(255,255,255,0.5);
        }

        .rm-url {
          font-size: 0.65rem;
          color: rgba(0,255,156,0.5);
          word-break: break-all;
        }

        .sev-counts {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .sev-chip {
          font-size: 0.6rem;
          letter-spacing: 0.1em;
          padding: 4px 10px;
          border-radius: 3px;
          border: 1px solid;
        }

        /* ── VULN LIST ── */
        .vuln-section {
          background: #080d1e;
          border: 1px solid rgba(0,255,156,0.1);
          border-radius: 6px;
          padding: 24px;
          position: relative;
          overflow: hidden;
        }

        .vuln-section::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0,255,156,0.4), transparent);
        }

        .section-title {
          font-family: 'Orbitron', monospace;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          color: rgba(255,255,255,0.5);
          margin-bottom: 16px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .vuln-list { display: flex; flex-direction: column; gap: 8px; }

        .vuln-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
          border-radius: 4px;
          border: 1px solid rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.02);
          cursor: pointer;
          transition: all 0.2s;
        }

        .vuln-item:hover { background: rgba(255,255,255,0.04); }

        .vuln-icon { font-size: 1rem; flex-shrink: 0; }

        .vuln-info { flex: 1; min-width: 0; }

        .vuln-name {
          font-size: 0.75rem;
          letter-spacing: 0.06em;
          color: rgba(255,255,255,0.7);
          margin-bottom: 2px;
        }

        .vuln-detail {
          font-size: 0.6rem;
          letter-spacing: 0.04em;
          color: rgba(255,255,255,0.25);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .vuln-badge {
          font-size: 0.58rem;
          letter-spacing: 0.12em;
          padding: 3px 8px;
          border-radius: 2px;
          border: 1px solid;
          flex-shrink: 0;
        }

        /* ── MODAL ── */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(6px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .modal-box {
          background: #080d1e;
          border: 1px solid rgba(0,255,156,0.25);
          border-radius: 8px;
          padding: 28px;
          max-width: 500px;
          width: 100%;
          position: relative;
        }

        .modal-box::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 2px;
          background: linear-gradient(90deg, transparent, #00FF9C, transparent);
        }

        .modal-close {
          position: absolute;
          top: 14px; right: 16px;
          background: none; border: none;
          color: rgba(255,255,255,0.3);
          cursor: pointer;
          font-size: 1.1rem;
          line-height: 1;
        }

        .modal-close:hover { color: #fff; }

        .modal-title {
          font-family: 'Orbitron', monospace;
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          margin-bottom: 16px;
        }

        .modal-field { margin-bottom: 14px; }

        .modal-field-label {
          font-size: 0.58rem;
          letter-spacing: 0.2em;
          color: rgba(255,255,255,0.25);
          margin-bottom: 4px;
          display: block;
        }

        .modal-field-val {
          font-size: 0.75rem;
          letter-spacing: 0.04em;
          color: rgba(255,255,255,0.65);
          line-height: 1.6;
        }

        .fix-box {
          background: rgba(0,255,156,0.05);
          border: 1px solid rgba(0,255,156,0.15);
          border-radius: 4px;
          padding: 12px 14px;
          font-size: 0.72rem;
          line-height: 1.6;
          color: rgba(0,255,156,0.7);
        }

        @media (max-width: 640px) {
          .scan-input-row { flex-direction: column; }
          .results-grid { grid-template-columns: 1fr; }
          .scanner-wrap { padding: 16px; }
        }
      `}</style>

              <div className="scanner-wrap">

                  {/* ── HEADING ── */}
                  <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
                      <h1 className="page-heading">⬡ SECURITY SCANNER</h1>
                      <span className="page-sub">AUTHORIZED PENETRATION TESTING · OWASP COMPLIANT</span>
                  </motion.div>

                  {/* ── INPUT PANEL ── */}
                  <motion.div
                      className="input-panel"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                  >
                      <span className="input-label">◈ TARGET URL OR IP ADDRESS</span>

                      <div className="scan-input-row">
                          <input
                              className="scan-input"
                              type="text"
                              placeholder="https://target-website.com"
                              value={target}
                              disabled={scanning}
                              onChange={(e) => setTarget(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleScan()} />
                          {done ? (
                              <button className="reset-btn" onClick={reset}>↺ RESET</button>
                          ) : (
                              <button
                                  className="scan-btn"
                                  onClick={handleScan}
                                  disabled={scanning || !target.trim()}
                              >
                                  {scanning ? "◎ SCANNING..." : "⚡ LAUNCH SCAN"}
                              </button>
                          )}
                      </div>

                      {/* Progress bar */}
                      <AnimatePresence>
                          {(scanning || done) && (
                              <motion.div
                                  className="progress-wrap"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                              >
                                  <div className="progress-meta">
                                      <span>{done ? "SCAN COMPLETE" : "SCANNING..."}</span>
                                      <span>{progress}%</span>
                                  </div>
                                  <div className="progress-track">
                                      <div className="progress-fill" style={{ width: `${progress}%` }} />
                                  </div>
                                  {scanning && <p className="stage-label">▸ {stageLabel}</p>}
                              </motion.div>
                          )}
                      </AnimatePresence>
                  </motion.div>

                  {/* ── TERMINAL ── */}
                  <AnimatePresence>
                      {logs.length > 0 && (
                          <motion.div
                              className="terminal-panel"
                              initial={{ opacity: 0, y: 16 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ delay: 0.1 }}
                          >
                              <div className="terminal-bar">
                                  <div className="t-dot" style={{ background: "#f87171" }} />
                                  <div className="t-dot" style={{ background: "#facc15" }} />
                                  <div className="t-dot" style={{ background: "#00FF9C" }} />
                                  <span className="terminal-bar-title">rootx — scan engine · {target}</span>
                              </div>
                              <div className="terminal-body" ref={logRef}>
                                  {logs.map((l, i) => (
                                      <motion.div
                                          key={l.id}
                                          className="log-line"
                                          initial={{ opacity: 0, x: -8 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ duration: 0.2 }}
                                      >
                                          <span className="log-tag" style={{ color: LOG_COLOR[l.type] ?? "#fff" }}>
                                              [{l.type}]
                                          </span>
                                          <span className="log-msg">{l.msg}</span>
                                      </motion.div>
                                  ))}
                                  {scanning && <div className="log-line"><span className="terminal-cursor" /></div>}
                              </div>
                          </motion.div>
                      )}
                  </AnimatePresence>

                  {/* ── RESULTS ── */}
                  <AnimatePresence>
                      {scanResult && (
                          <motion.div
                              initial={{ opacity: 0, y: 24 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.5 }}
                          >
                              {/* Score + summary */}
                              <div className="results-grid">
                                  <ScoreRing score={scanResult.score} visible={!!scanResult} />
                                  <div className="result-meta">
                                      <div
                                          style={{
                                              marginTop: "14px",
                                              display: "flex",
                                              flexWrap: "wrap",
                                              gap: "8px",
                                          }}
                                      >

                                          {scanResult.technologies?.map(
                                              (tech: string, index: number) => (

                                                  <span
                                                      key={index}
                                                      style={{
                                                          background: "rgba(0,255,156,0.08)",
                                                          border: "1px solid rgba(0,255,156,0.2)",
                                                          color: "#00FF9C",
                                                          padding: "6px 10px",
                                                          borderRadius: "4px",
                                                          fontSize: "0.65rem",
                                                          fontFamily: "monospace",
                                                          letterSpacing: "0.08em",
                                                      }}
                                                  >
                                                      ◈ {tech}
                                                  </span>

                                              )
                                          )}

                                      </div>
                                      <span className="rm-title">SCAN REPORT</span>
                                      <span className="rm-url">▸ {target}</span>
                                      <div className="sev-counts">
                                          {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((s) => {
                                              const count = scanResult.vulnerabilities.filter(v => v.severity === s).length;
                                              if (!count) return null;
                                              const c = SEV[s].color;
                                              return (
                                                  <span key={s} className="sev-chip"
                                                      style={{ color: c, borderColor: `${c}40`, background: SEV[s].bg }}>
                                                      {count} {s}
                                                  </span>
                                              );
                                          })}
                                      </div>
                                      <span style={{
                                          fontFamily: "'Courier New', monospace",
                                          fontSize: "0.62rem",
                                          letterSpacing: "0.1em",
                                          color: "rgba(255,255,255,0.2)",
                                      }}>
                                          SCANNED {new Date().toLocaleString().toUpperCase()}
                                      </span>
                                  </div>
                              </div>

                              {/* Vulnerability list */}
                              <div className="vuln-section">
                                  <div className="section-title">
                                      ▦ VULNERABILITY MATRIX
                                      <span style={{ color: "#f87171", fontWeight: "normal", fontSize: "0.6rem" }}>
                                          {scanResult.vulnerabilities.length} ISSUES FOUND
                                      </span>
                                  </div>
                                  <div className="vuln-list">
                                      {scanResult.vulnerabilities.map((v, i) => {
                                          const s = SEV[v.severity];
                                          return (
                                              <motion.div
                                                  key={i}
                                                  className="vuln-item"
                                                  initial={{ opacity: 0, x: -12 }}
                                                  animate={{ opacity: 1, x: 0 }}
                                                  transition={{ delay: i * 0.07 }}
                                                  style={{ borderColor: `${s.color}20` }}
                                                  onClick={() => setActiveVuln(v)}
                                                  whileHover={{ borderColor: `${s.color}50` }}
                                              >
                                                  <span className="vuln-icon" style={{ color: s.color }}>{s.icon}</span>
                                                  <div className="vuln-info">
                                                      <p className="vuln-name">{v.name}</p>
                                                      <p className="vuln-detail">{v.detail}</p>
                                                  </div>
                                                  <span className="vuln-badge"
                                                      style={{ color: s.color, borderColor: `${s.color}40`, background: s.bg }}>
                                                      {v.severity}
                                                  </span>
                                                  <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.75rem" }}>›</span>
                                              </motion.div>
                                          );
                                      })}
                                  </div>
                              </div>
                          </motion.div>
                      )}
                  </AnimatePresence>

                  {/* ── VULN DETAIL MODAL ── */}
                  <AnimatePresence>
                      {activeVuln && (
                          <motion.div
                              className="modal-overlay"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              onClick={() => setActiveVuln(null)}
                          >
                              <motion.div
                                  className="modal-box"
                                  initial={{ scale: 0.92, y: 20 }}
                                  animate={{ scale: 1, y: 0 }}
                                  exit={{ scale: 0.92, y: 20 }}
                                  onClick={(e) => e.stopPropagation()}
                              >
                                  <button className="modal-close" onClick={() => setActiveVuln(null)}>✕</button>

                                  <div className="modal-title" style={{ color: SEV[activeVuln.severity].color }}>
                                      {SEV[activeVuln.severity].icon} {activeVuln.name}
                                  </div>

                                  <div className="modal-field">
                                      <span className="modal-field-label">SEVERITY</span>
                                      <span className="vuln-badge" style={{
                                          color: SEV[activeVuln.severity].color,
                                          borderColor: `${SEV[activeVuln.severity].color}40`,
                                          background: SEV[activeVuln.severity].bg,
                                          fontSize: "0.68rem",
                                          padding: "4px 12px",
                                      }}>{activeVuln.severity}</span>
                                  </div>

                                  <div className="modal-field">
                                      <span className="modal-field-label">FINDING</span>
                                      <p className="modal-field-val">{activeVuln.detail}</p>
                                  </div>

                                  <div className="modal-field">
                                      <span className="modal-field-label">AI RECOMMENDED FIX</span>
                                      <div className="fix-box">
                                          {activeVuln.severity === "CRITICAL" && activeVuln.name.includes("SQL") &&
                                              "Use parameterized queries or prepared statements. Never concatenate user input into SQL strings. Apply an ORM like Prisma or Sequelize."}
                                          {activeVuln.severity === "CRITICAL" && activeVuln.name.includes("XSS") &&
                                              "Sanitize all user inputs using DOMPurify. Use Content-Security-Policy headers. Encode output before rendering in HTML context."}
                                          {activeVuln.name.includes("Port") &&
                                              "Close unused ports via firewall rules. If needed, restrict access to trusted IPs only using iptables or cloud security groups."}
                                          {activeVuln.name.includes("SSH") &&
                                              "Disable password auth, use SSH keys only. Move SSH to a non-standard port. Whitelist access using firewall rules."}
                                          {activeVuln.name.includes("CSP") &&
                                              "Add Content-Security-Policy header in your server config. Start with: Content-Security-Policy: default-src 'self'"}
                                          {activeVuln.name.includes("Clickjacking") &&
                                              "Set X-Frame-Options: DENY or SAMEORIGIN in your HTTP response headers to prevent iframe embedding."}
                                          {activeVuln.name.includes("SSL") &&
                                              "Renew your SSL certificate immediately using Let's Encrypt (free). Set up auto-renewal via certbot."}
                                      </div>
                                  </div>
                              </motion.div>
                          </motion.div>
                      )}
                  </AnimatePresence>

              </div>
          </></>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
/* ─────────────────────────────────────────────
   LIVE ACTIVITY FEED
───────────────────────────────────────────── */
const INITIAL_LOGS = [
  { id: 1, type: "CRIT", msg: "SQL Injection probe at /api/users?id=",   time: "14:32:01" },
  { id: 2, type: "WARN", msg: "Open port 8080 — unencrypted HTTP",        time: "14:31:48" },
  { id: 3, type: "INFO", msg: "Nmap scan completed — 3 open ports found", time: "14:31:22" },
  { id: 4, type: "CRIT", msg: "XSS detected on /search?q= parameter",    time: "14:30:55" },
  { id: 5, type: "OK",   msg: "SSL/TLS handshake verified",               time: "14:30:10" },
];

const LIVE_EVENTS = [
  { type: "WARN", msg: "Brute force attempt — 24 failed logins from 10.0.0.5" },
  { type: "INFO", msg: "AI analysis complete — remediation report ready" },
  { type: "CRIT", msg: "Path traversal attempt: /../../etc/passwd" },
  { type: "OK",   msg: "Security headers scan passed" },
  { type: "WARN", msg: "Outdated jQuery v1.x detected on /assets" },
];

function ActivityFeed() {
  const [logs, setLogs] = useState(INITIAL_LOGS);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      const ev = LIVE_EVENTS[idx % LIVE_EVENTS.length];
      const now = new Date();
      const t = [
        now.getHours().toString().padStart(2, "0"),
        now.getMinutes().toString().padStart(2, "0"),
        now.getSeconds().toString().padStart(2, "0"),
      ].join(":");
      setLogs((prev) => [{ id: Date.now(), ...ev, time: t }, ...prev.slice(0, 9)]);
      setIdx((i) => i + 1);
    }, 3500);
    return () => clearInterval(id);
  }, [idx]);

  const typeColor: Record<string, string> = {
    CRIT: "#f87171",
    WARN: "#facc15",
    INFO: "#22d3ee",
    OK:   "#00FF9C",
  };

  return (
    <div className="feed-panel">
      <div className="panel-header">
        <span className="panel-title">◈ LIVE ACTIVITY FEED</span>
        <span className="live-badge">● LIVE</span>
      </div>
      <div className="feed-list">
        <AnimatePresence>
          {logs.map((log) => (
            <motion.div
              key={log.id}
              className="feed-item"
              initial={{ opacity: 0, x: -12, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <span
                className="feed-type"
                style={{ color: typeColor[log.type] ?? "#fff" }}
              >
                [{log.type}]
              </span>
              <span className="feed-msg">{log.msg}</span>
              <span className="feed-time">{log.time}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}



/* ─────────────────────────────────────────────
   VULNERABILITY TABLE
───────────────────────────────────────────── */
const VULNS = [
  { name: "SQL Injection",        severity: "CRITICAL", location: "/api/login",   status: "OPEN"    },
  { name: "Cross-Site Scripting", severity: "HIGH",     location: "/search",      status: "OPEN"    },
  { name: "Open Port 8080",       severity: "MEDIUM",   location: "Network",      status: "OPEN"    },
  { name: "Outdated jQuery",      severity: "MEDIUM",   location: "/assets/js",   status: "REVIEW"  },
  { name: "Missing CSP Header",   severity: "LOW",      location: "HTTP Headers", status: "OPEN"    },
  { name: "SSL Cert Expiry",      severity: "LOW",      location: "TLS Layer",    status: "MONITOR" },
];

function VulnTable() {
  const sevColor: Record<string, string> = {
    CRITICAL: "#f87171",
    HIGH:     "#fb923c",
    MEDIUM:   "#facc15",
    LOW:      "#22d3ee",
  };
  const statusColor: Record<string, string> = {
    OPEN:    "#f87171",
    REVIEW:  "#facc15",
    MONITOR: "#22d3ee",
    FIXED:   "#00FF9C",
  };

  return (
    <div className="vuln-panel">
      <div className="panel-header">
        <span className="panel-title">▦ VULNERABILITY MATRIX</span>
        <span style={{ fontFamily: "monospace", fontSize: "0.6rem",
          letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)" }}>
          {VULNS.length} FOUND
        </span>
      </div>
      <div className="vuln-table-wrap">
        <table className="vuln-table">
          <thead>
            <tr>
              {["VULNERABILITY", "SEVERITY", "LOCATION", "STATUS"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VULNS.map((v, i) => (
              <motion.tr
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i }}
                className="vuln-row"
              >
                <td className="vuln-name">{v.name}</td>
                <td>
                  <span className="sev-badge" style={{ color: sevColor[v.severity],
                    borderColor: `${sevColor[v.severity]}40`,
                    background: `${sevColor[v.severity]}12` }}>
                    {v.severity}
                  </span>
                </td>
                <td className="vuln-loc">{v.location}</td>
                <td>
                  <span className="sev-badge" style={{ color: statusColor[v.status],
                    borderColor: `${statusColor[v.status]}40`,
                    background: `${statusColor[v.status]}12` }}>
                    {v.status}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN DASHBOARD PAGE
───────────────────────────────────────────── */
function DashboardPage() {
  const [target, setTarget] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const handleScan = async () => {
    const response = await fetch("/api/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target,
      }),
    });

    const data = await response.json();
    setScanResult(data);
  };

  return (
    <>
      <style jsx>{`
        .dash-root {
          display: flex;
          background: #050816;
          color: #fff;
          min-height: 100vh;
        }

        .dash-main {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          background-image:
            linear-gradient(rgba(0,255,156,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,156,0.025) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        .dash-content {
          padding: 28px 32px;
          flex: 1;
        }

        /* Page header */
        .dash-page-header {
          margin-bottom: 28px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
        }

        .dash-title {
          font-family: 'Orbitron', monospace;
          font-size: 1.4rem;
          font-weight: 900;
          color: #00FF9C;
          letter-spacing: 0.08em;
          text-shadow: 0 0 20px rgba(0,255,156,0.4);
        }

        .dash-sub {
          font-family: 'Courier New', monospace;
          font-size: 0.65rem;
          letter-spacing: 0.15em;
          color: rgba(255,255,255,0.3);
          margin-top: 4px;
          display: block;
        }

        .last-scan {
          font-family: 'Courier New', monospace;
          font-size: 0.6rem;
          letter-spacing: 0.1em;
          color: rgba(255,255,255,0.25);
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 3px;
          padding: 6px 12px;
        }

        /* Cards grid */
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        /* Bottom grid */
        .bottom-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 24px;
        }

        @media (max-width: 900px) {
          .bottom-grid { grid-template-columns: 1fr; }
        }

        /* Score section */
        .score-section {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 24px;
          background: #0a1128;
          border: 1px solid rgba(0,255,156,0.12);
          border-radius: 6px;
          padding: 24px;
          margin-bottom: 24px;
          position: relative;
          overflow: hidden;
        }

        .score-section::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0,255,156,0.4), transparent);
        }

        .score-ring-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .score-details {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
        }

        .score-details-title {
          font-family: 'Orbitron', monospace;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: rgba(255,255,255,0.7);
        }

        .score-breakdown {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 4px;
        }

        .score-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .score-row-label {
          font-family: 'Courier New', monospace;
          font-size: 0.62rem;
          letter-spacing: 0.08em;
          color: rgba(255,255,255,0.35);
          width: 130px;
          flex-shrink: 0;
        }

        .score-bar-track {
          flex: 1;
          height: 4px;
          background: rgba(255,255,255,0.06);
          border-radius: 2px;
          overflow: hidden;
        }

        .score-bar-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 1.5s ease-out;
        }

        .score-row-val {
          font-family: 'Courier New', monospace;
          font-size: 0.62rem;
          color: rgba(255,255,255,0.4);
          width: 30px;
          text-align: right;
          flex-shrink: 0;
        }

        /* Panel shared */
        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .panel-title {
          font-family: 'Orbitron', monospace;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: rgba(255,255,255,0.6);
        }

        .live-badge {
          font-family: 'Courier New', monospace;
          font-size: 0.6rem;
          letter-spacing: 0.1em;
          color: #00FF9C;
          animation: blink-live 1.5s ease-in-out infinite;
        }

        @keyframes blink-live {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.3; }
        }

        /* Feed */
        .feed-panel {
          background: #0a1128;
          border: 1px solid rgba(0,255,156,0.1);
          border-radius: 6px;
          padding: 20px;
          position: relative;
          overflow: hidden;
        }

        .feed-panel::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0,255,156,0.3), transparent);
        }

        .feed-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-height: 280px;
          overflow: hidden;
        }

        .feed-item {
          display: flex;
          align-items: baseline;
          gap: 8px;
          font-family: 'Courier New', monospace;
          font-size: 0.65rem;
          letter-spacing: 0.04em;
          padding: 5px 8px;
          border-radius: 3px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.04);
        }

        .feed-type {
          font-weight: bold;
          flex-shrink: 0;
          min-width: 50px;
        }

        .feed-msg {
          flex: 1;
          color: rgba(255,255,255,0.5);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .feed-time {
          color: rgba(255,255,255,0.2);
          flex-shrink: 0;
        }

        /* Vuln table */
        .vuln-panel {
          background: #0a1128;
          border: 1px solid rgba(0,255,156,0.1);
          border-radius: 6px;
          padding: 20px;
          position: relative;
          overflow: hidden;
        }

        .vuln-panel::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0,255,156,0.3), transparent);
        }

        .vuln-table-wrap { overflow-x: auto; }

        .vuln-table {
          width: 100%;
          border-collapse: collapse;
          font-family: 'Courier New', monospace;
          font-size: 0.65rem;
        }

        .vuln-table th {
          text-align: left;
          letter-spacing: 0.15em;
          color: rgba(255,255,255,0.2);
          padding: 0 12px 10px 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          font-weight: normal;
        }

        .vuln-row {
          border-bottom: 1px solid rgba(255,255,255,0.03);
        }

        .vuln-row:hover {
          background: rgba(255,255,255,0.02);
        }

        .vuln-row td {
          padding: 9px 12px 9px 0;
        }

        .vuln-name {
          color: rgba(255,255,255,0.65) !important;
        }

        .vuln-loc {
          color: rgba(255,255,255,0.3) !important;
        }

        .sev-badge {
          font-family: 'Courier New', monospace;
          font-size: 0.58rem;
          letter-spacing: 0.1em;
          padding: 2px 8px;
          border: 1px solid;
          border-radius: 2px;
          white-space: nowrap;
        }
      `}</style>

      <div className="dash-root">
        <Slidebar />

        <div className="dash-main">
          <Navbar />
          <ScannerEngine />
          <main className="dash-content">

            {/* Page header */}
            <motion.div
              className="dash-page-header"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div>
                <h1 className="dash-title">SECURITY OVERVIEW</h1>
                <span className="dash-sub">
                  AI-POWERED CYBERSECURITY MONITORING PLATFORM
                </span>
              </div>
              <div className="last-scan">
                ◎ LAST SCAN: TODAY AT 14:32:01
              </div>
            </motion.div>

            {/* ── STAT CARDS ── */}
            <div className="cards-grid">
              <SecurityCard
                title="Security Score"
                value="82/100"
                color="green"
                icon="◎"
                trend="up"
                trendVal="+5pts"
                subtext="Last updated 14:32"
                animate={true}
                numericValue={82}
              />
              <SecurityCard
                title="Threats Detected"
                value="12"
                color="red"
                icon="⚠"
                trend="up"
                trendVal="+3 new"
                subtext="3 critical, 4 high"
                animate={true}
                numericValue={12}
              />
              <SecurityCard
                title="Scans Completed"
                value="156"
                color="cyan"
                icon="▦"
                trend="stable"
                trendVal="stable"
                subtext="Since deployment"
                animate={true}
                numericValue={156}
              />
              <SecurityCard
                title="Open Ports"
                value="7"
                color="yellow"
                icon="◈"
                trend="down"
                trendVal="-2 closed"
                subtext="3 flagged"
                animate={true}
                numericValue={7}
              />
            </div>

            {/* ── SCORE BREAKDOWN ── */}
            <motion.div
              className="score-section"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <ScoreRing score={82} visible={false} />
              <div className="score-details">
                <span className="score-details-title">RISK BREAKDOWN</span>
                <div className="score-breakdown">
                  {[
                    { label: "Authentication",    val: 90, color: "#00FF9C" },
                    { label: "Input Validation",  val: 58, color: "#facc15" },
                    { label: "Network Security",  val: 74, color: "#22d3ee" },
                    { label: "SSL / TLS Config",  val: 95, color: "#00FF9C" },
                    { label: "HTTP Headers",      val: 45, color: "#f87171" },
                  ].map((item) => (
                    <div key={item.label} className="score-row">
                      <span className="score-row-label">{item.label}</span>
                      <div className="score-bar-track">
                        <motion.div
                          className="score-bar-fill"
                          style={{ background: item.color }}
                          initial={{ width: "0%" }}
                          animate={{ width: `${item.val}%` }}
                          transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                        />
                      </div>
                      <span className="score-row-val">{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* ── BOTTOM GRID: Feed + Vulns ── */}
            <motion.div
              className="bottom-grid"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <ActivityFeed />
              <VulnTable />
            </motion.div>

          </main>
        </div>
      </div>
    </>
  );
}