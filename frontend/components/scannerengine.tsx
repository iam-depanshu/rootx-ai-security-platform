"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSocket } from "@/lib/socket";

/* ─── TYPES ─── */
type Vuln = {
  name: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  detail: string;
  fix?: string;
  cve?: string;
  proof?: string;
};

type ScanResult = {
  sslGrade: string;
  score: number;
  status: string;
  vulnerabilities: Vuln[];
  technologies?: string[];
  threats?: {
    technology: string;
    risk: string;
    severity: string;
    cve?: string;
  }[];
  discoveredPanels?: string[];
};

type LogLine = { id: number; type: string; msg: string };

/* ─── SEVERITY CONFIG ─── */
const SEV: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  CRITICAL: { color: "#f87171", bg: "rgba(248,113,113,0.08)",  border: "rgba(248,113,113,0.3)",  icon: "☠" },
  HIGH:     { color: "#fb923c", bg: "rgba(251,146,60,0.08)",   border: "rgba(251,146,60,0.3)",   icon: "⚠" },
  MEDIUM:   { color: "#facc15", bg: "rgba(250,204,21,0.08)",   border: "rgba(250,204,21,0.3)",   icon: "◎" },
  LOW:      { color: "#22d3ee", bg: "rgba(34,211,238,0.08)",   border: "rgba(34,211,238,0.3)",   icon: "▸" },
};

const LOG_COLOR: Record<string, string> = {
  CRIT: "#f87171",
  WARN: "#facc15",
  INFO: "#22d3ee",
  OK:   "#00FF9C",
};

/* ─── SCORE RING ─── */
function ScoreRing({ score }: { score: number }) {
  const r    = 48;
  const circ = 2 * Math.PI * r;
  const fill = circ * (score / 100);
  const color = score >= 70 ? "#00FF9C" : score >= 40 ? "#facc15" : "#f87171";
  const label = score >= 70 ? "SECURE" : score >= 40 ? "MODERATE" : "CRITICAL";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <motion.circle
          cx="60" cy="60" r={r}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${circ}`} strokeDashoffset={circ}
          animate={{ strokeDashoffset: circ - fill }}
          transition={{ duration: 2, ease: "easeOut", delay: 0.3 }}
          transform="rotate(-90 60 60)"
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
        <text x="60" y="56" textAnchor="middle" fill={color}
          style={{ fontFamily: "'Orbitron', monospace", fontSize: 24, fontWeight: 900 }}>
          {score}
        </text>
        <text x="60" y="70" textAnchor="middle" fill="rgba(255,255,255,0.3)"
          style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: 2 }}>
          /100
        </text>
      </svg>
      <span style={{ fontFamily: "monospace", fontSize: "0.6rem", letterSpacing: "0.2em", color, textShadow: `0 0 10px ${color}` }}>
        {label}
      </span>
    </div>
  );
}

/* ─── MAIN COMPONENT ─── */
export default function ScannerEngine() {
  const [target,     setTarget]     = useState("");
  const [scanning,   setScanning]   = useState(false);
  const [done,       setDone]       = useState(false);
  const [logs,       setLogs]       = useState<LogLine[]>([]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [progress,   setProgress]   = useState(0);
  const [stageLabel, setStageLabel] = useState("");
  const [activeVuln, setActiveVuln] = useState<Vuln | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const handleScan = async () => {
    if (!target.trim() || scanning) return;
    setScanning(true);
    setDone(false);
    setScanResult(null);
    setLogs([]);
    setProgress(0);

    const socket = getSocket();
    let logId = 0;

    // Add initial log
    setLogs([{ id: logId++, type: 'INFO', msg: 'Initializing RootX scan engine...' }]);

    // Listen for real scan step events
    const onStep = (data: { module: string; label: string; status: string }) => {
      if (data.status === 'running') {
        setLogs(prev => [...prev, { id: logId++, type: 'INFO', msg: `▸ ${data.label}` }]);
        setStageLabel(data.label);
      } else if (data.status === 'done') {
        setLogs(prev => [...prev, { id: logId++, type: 'OK', msg: `✓ ${data.label}` }]);
      }
    };

    const onProgress = (data: { progress: number; score: number }) => {
      setProgress(data.progress);
    };

    const onVuln = (vuln: { name: string; severity: string }) => {
      const type = vuln.severity === 'CRITICAL' ? 'CRIT' : vuln.severity === 'HIGH' ? 'WARN' : 'INFO';
      setLogs(prev => [...prev, { id: logId++, type, msg: `☠ Found: ${vuln.name} [${vuln.severity}]` }]);
    };

    socket.on('scan:step', onStep);
    socket.on('scan:progress', onProgress);
    socket.on('scan:vuln', onVuln);

    // Trigger the scan via API
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      setProgress(100);
      setScanResult(data);
    } catch (e) {
      console.error(e);
      setScanResult({
        score: 0, status: 'SCAN FAILED', sslGrade: 'F',
        vulnerabilities: [{ name: 'Connection Failed', severity: 'CRITICAL', detail: 'Could not connect.', fix: 'Check the URL and backend.' }],
      });
    }

    // Cleanup listeners
    socket.off('scan:step', onStep);
    socket.off('scan:progress', onProgress);
    socket.off('scan:vuln', onVuln);

    setScanning(false);
    setDone(true);
  };

  const handleReset = () => {
    setDone(false);
    setScanResult(null);
    setLogs([]);
    setProgress(0);
    setTarget("");
  };

  /* ── AI fix suggestion ── */
  function getAIFix(vuln: Vuln): string {
    // Use the fix from API if available
    if (vuln.fix) return vuln.fix;

    // Fallback suggestions
    const n = vuln.name.toLowerCase();
    if (n.includes("sql"))        return "Use parameterized queries or an ORM. Never concatenate user input into SQL strings.";
    if (n.includes("xss"))        return "Sanitize all user inputs with DOMPurify. Set Content-Security-Policy header. Use React JSX which auto-escapes.";
    if (n.includes("csrf"))       return "Add CSRF tokens to all state-changing forms. Use SameSite=Strict cookie attribute.";
    if (n.includes("ssl") || n.includes("https")) return "Enable HTTPS with a free Let's Encrypt cert: certbot --nginx -d yourdomain.com";
    if (n.includes("csp"))        return "Add: Content-Security-Policy: default-src 'self'; script-src 'self'";
    if (n.includes("hsts"))       return "Add: Strict-Transport-Security: max-age=31536000; includeSubDomains";
    if (n.includes("cookie"))     return "Set HttpOnly, Secure, SameSite=Strict on all session cookies.";
    if (n.includes("admin"))      return "Protect admin routes with authentication + IP allowlist. Never expose admin panels publicly.";
    if (n.includes("access") || n.includes("idor")) return "Verify object ownership server-side on every request. Never trust client-supplied IDs.";
    if (n.includes("clickjack"))  return "Add X-Frame-Options: DENY to all HTTP responses.";
    return "Review OWASP guidelines for this vulnerability type at owasp.org/Top10";
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');

        .se-wrap { background: #080d1e; padding: 28px; font-family: 'Courier New', monospace; color: #fff; }
        .se-input-label { font-size: 0.6rem; letter-spacing: 0.22em; color: rgba(0,255,156,0.6); display: block; margin-bottom: 10px; }
        .se-input-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
        .se-input { flex: 1; min-width: 200px; background: rgba(0,0,0,0.5); border: 1px solid rgba(0,255,156,0.2); border-radius: 4px; padding: 13px 16px; color: #00FF9C; font-family: 'Courier New', monospace; font-size: 0.85rem; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
        .se-input::placeholder { color: rgba(0,255,156,0.25); }
        .se-input:focus { border-color: rgba(0,255,156,0.55); box-shadow: 0 0 16px rgba(0,255,156,0.1); }
        .se-btn { font-family: 'Orbitron', monospace; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.14em; color: #050816; background: #00FF9C; border: none; border-radius: 4px; padding: 13px 26px; cursor: pointer; transition: all 0.2s; white-space: nowrap; flex-shrink: 0; }
        .se-btn:hover:not(:disabled) { background: #fff; box-shadow: 0 0 28px rgba(0,255,156,0.55); }
        .se-btn:disabled { background: rgba(0,255,156,0.15); color: rgba(0,255,156,0.4); cursor: not-allowed; }
        .se-reset-btn { font-family: 'Orbitron', monospace; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.12em; color: #00FF9C; background: transparent; border: 1px solid rgba(0,255,156,0.3); border-radius: 4px; padding: 12px 20px; cursor: pointer; transition: all 0.2s; }
        .se-reset-btn:hover { background: rgba(0,255,156,0.07); border-color: rgba(0,255,156,0.6); }

        .se-progress-wrap { margin-top: 18px; }
        .se-progress-meta { display: flex; justify-content: space-between; font-size: 0.6rem; letter-spacing: 0.1em; color: rgba(255,255,255,0.3); margin-bottom: 6px; }
        .se-track { width: 100%; height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; }
        .se-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, #00FF9C, #22d3ee); box-shadow: 0 0 10px rgba(0,255,156,0.5); transition: width 0.4s ease; }
        .se-stage { margin-top: 7px; font-size: 0.6rem; letter-spacing: 0.07em; color: rgba(255,255,255,0.22); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .se-terminal { margin-top: 22px; background: #020509; border: 1px solid rgba(0,255,156,0.1); border-radius: 6px; overflow: hidden; }
        .se-term-bar { display: flex; align-items: center; gap: 7px; padding: 9px 14px; background: #080d1e; border-bottom: 1px solid rgba(0,255,156,0.08); }
        .se-dot { width: 10px; height: 10px; border-radius: 50%; }
        .se-term-title { margin-left: 8px; font-size: 0.62rem; letter-spacing: 0.1em; color: rgba(255,255,255,0.22); }
        .se-term-body { padding: 14px 16px; height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; scrollbar-width: thin; scrollbar-color: rgba(0,255,156,0.15) transparent; }
        .se-log-line { display: flex; gap: 10px; font-size: 0.67rem; letter-spacing: 0.04em; line-height: 1.6; }
        .se-log-tag { flex-shrink: 0; min-width: 44px; font-weight: bold; }
        .se-log-msg { color: rgba(255,255,255,0.42); }
        .se-cursor { display: inline-block; width: 8px; height: 13px; background: #00FF9C; animation: cur-blink 1s step-end infinite; vertical-align: middle; margin-left: 4px; }
        @keyframes cur-blink { 50% { opacity: 0; } }

        .se-results-wrap { margin-top: 22px; }
        .se-score-row { display: grid; grid-template-columns: auto 1fr; gap: 24px; align-items: center; background: #0a1128; border: 1px solid rgba(0,255,156,0.12); border-radius: 6px; padding: 22px; margin-bottom: 18px; position: relative; overflow: hidden; }
        .se-score-row::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 1px; background: linear-gradient(90deg, transparent, rgba(0,255,156,0.45), transparent); }
        .se-score-meta { display: flex; flex-direction: column; gap: 10px; }
        .se-score-title { font-family: 'Orbitron', monospace; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.15em; color: rgba(255,255,255,0.45); }
        .se-score-url { font-size: 0.65rem; color: rgba(0,255,156,0.45); word-break: break-all; }
        .se-sev-counts { display: flex; gap: 8px; flex-wrap: wrap; }
        .se-sev-chip { font-size: 0.58rem; letter-spacing: 0.1em; padding: 3px 9px; border-radius: 3px; border: 1px solid; }

        .se-vuln-panel { background: #0a1128; border: 1px solid rgba(0,255,156,0.1); border-radius: 6px; padding: 20px; position: relative; overflow: hidden; margin-bottom: 18px; }
        .se-vuln-panel::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 1px; background: linear-gradient(90deg, transparent, rgba(0,255,156,0.35), transparent); }
        .se-vuln-title { font-family: 'Orbitron', monospace; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.18em; color: rgba(255,255,255,0.45); margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between; }
        .se-vuln-count { color: #f87171; font-size: 0.6rem; font-weight: normal; }
        .se-vuln-list { display: flex; flex-direction: column; gap: 8px; }
        .se-vuln-item { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02); cursor: pointer; transition: all 0.2s; }
        .se-vuln-item:hover { background: rgba(255,255,255,0.04); }
        .se-vuln-icon { font-size: 0.95rem; flex-shrink: 0; }
        .se-vuln-info { flex: 1; min-width: 0; }
        .se-vuln-name { font-size: 0.73rem; letter-spacing: 0.05em; color: rgba(255,255,255,0.68); margin-bottom: 2px; }
        .se-vuln-detail { font-size: 0.6rem; color: rgba(255,255,255,0.22); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .se-vuln-proof { font-size: 0.58rem; color: rgba(0,255,156,0.4); margin-top: 3px; font-family: monospace; }
        .se-vuln-badge { font-size: 0.56rem; letter-spacing: 0.1em; padding: 3px 8px; border-radius: 2px; border: 1px solid; flex-shrink: 0; }
        .se-arrow { color: rgba(255,255,255,0.18); font-size: 0.8rem; flex-shrink: 0; }

        .tech-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
        .tech-tag { font-size: 0.65rem; padding: 3px 10px; border: 1px solid rgba(0,255,156,0.2); border-radius: 3px; color: rgba(0,255,156,0.6); background: rgba(0,255,156,0.04); }

        /* Modal */
        .se-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.82); backdrop-filter: blur(8px); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .se-modal { background: #080d1e; border: 1px solid rgba(0,255,156,0.25); border-radius: 8px; padding: 28px; max-width: 520px; width: 100%; position: relative; max-height: 80vh; overflow-y: auto; }
        .se-modal::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: linear-gradient(90deg, transparent, #00FF9C, transparent); }
        .se-modal-close { position: absolute; top: 14px; right: 16px; background: none; border: none; color: rgba(255,255,255,0.3); font-size: 1rem; cursor: pointer; }
        .se-modal-close:hover { color: #fff; }
        .se-modal-title { font-family: 'Orbitron', monospace; font-size: 0.82rem; font-weight: 700; letter-spacing: 0.08em; margin-bottom: 18px; }
        .se-modal-label { font-size: 0.56rem; letter-spacing: 0.2em; color: rgba(255,255,255,0.22); display: block; margin-bottom: 5px; margin-top: 14px; }
        .se-modal-val { font-size: 0.73rem; letter-spacing: 0.04em; color: rgba(255,255,255,0.6); line-height: 1.6; display: block; }
        .se-fix-box { background: rgba(0,255,156,0.05); border: 1px solid rgba(0,255,156,0.15); border-radius: 4px; padding: 12px 14px; font-size: 0.7rem; line-height: 1.7; color: rgba(0,255,156,0.7); margin-top: 6px; }
        .se-proof-box { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; padding: 10px 12px; font-family: monospace; font-size: 0.65rem; color: rgba(34,211,238,0.7); margin-top: 6px; }

        @media (max-width: 600px) {
          .se-input-row { flex-direction: column; }
          .se-score-row { grid-template-columns: 1fr; }
          .se-wrap { padding: 16px; }
        }
      `}</style>

      <div className="se-wrap">

        {/* ── INPUT ── */}
        <span className="se-input-label">◈ ENTER TARGET URL OR IP ADDRESS</span>
        <div className="se-input-row">
          <input
            className="se-input"
            type="text"
            placeholder="http://localhost:3001  (OWASP Juice Shop)"
            value={target}
            disabled={scanning}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
          />
          {done ? (
            <button className="se-reset-btn" onClick={handleReset}>↺ RESET</button>
          ) : (
            <button className="se-btn" onClick={handleScan} disabled={scanning || !target.trim()}>
              {scanning ? "◎ SCANNING..." : "⚡ LAUNCH SCAN"}
            </button>
          )}
        </div>

        {/* ── PROGRESS BAR ── */}
        <AnimatePresence>
          {(scanning || done) && (
            <motion.div className="se-progress-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="se-progress-meta">
                <span>{done ? "✓ SCAN COMPLETE" : "SCANNING..."}</span>
                <span>{progress}%</span>
              </div>
              <div className="se-track">
                <div className="se-fill" style={{ width: `${progress}%` }} />
              </div>
              {scanning && <p className="se-stage">▸ {stageLabel}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── TERMINAL ── */}
        <AnimatePresence>
          {logs.length > 0 && (
            <motion.div className="se-terminal" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="se-term-bar">
                <div className="se-dot" style={{ background: "#f87171" }} />
                <div className="se-dot" style={{ background: "#facc15" }} />
                <div className="se-dot" style={{ background: "#00FF9C" }} />
                <span className="se-term-title">rootx — scan engine · {target}</span>
              </div>
              <div className="se-term-body" ref={logRef}>
                {logs.map((l) => (
                  <motion.div key={`log-${l.id}`} className="se-log-line" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
                    <span className="se-log-tag" style={{ color: LOG_COLOR[l.type] ?? "#fff" }}>[{l.type}]</span>
                    <span className="se-log-msg">{l.msg}</span>
                  </motion.div>
                ))}
                {scanning && <div className="se-log-line"><span className="se-cursor" /></div>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── SCAN RESULTS ── */}
        <AnimatePresence>
          {scanResult && (
            <motion.div className="se-results-wrap" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>

              {/* Score + summary */}
              <div className="se-score-row">
                <ScoreRing score={scanResult.score} />
                <div className="se-score-meta">
                  <span className="se-score-title">SCAN REPORT</span>
                  <span className="se-score-url">▸ {target}</span>
                  <div className="se-sev-counts">
                    {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((s) => {
                      const count = (scanResult.vulnerabilities || []).filter((v) => v.severity === s).length;
                      if (!count) return null;
                      return (
                        <span key={`sev-${s}`} className="se-sev-chip" style={{ color: SEV[s].color, borderColor: SEV[s].border, background: SEV[s].bg }}>
                          {count} {s}
                        </span>
                      );
                    })}
                  </div>
                  <span style={{ fontSize: "0.6rem", letterSpacing: "0.08em", color: "rgba(255,255,255,0.18)" }}>
                    SCANNED {new Date().toLocaleString().toUpperCase()}
                  </span>
                </div>
              </div>

              {/* SSL / TLS */}
              <div className="se-vuln-panel">
                <div className="se-vuln-title">SSL / TLS STATUS</div>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <span className="se-sev-chip" style={{ color: scanResult.sslGrade === "A" ? "#00FF9C" : "#f87171", borderColor: "rgba(255,255,255,0.1)" }}>
                    SSL GRADE: {scanResult.sslGrade}
                  </span>
                  <span className="se-sev-chip" style={{ color: scanResult.status === "SAFE" ? "#00FF9C" : "#f87171", borderColor: "rgba(255,255,255,0.1)" }}>
                    STATUS: {scanResult.status}
                  </span>
                </div>
              </div>

              {/* Technologies detected */}
              {scanResult.technologies && scanResult.technologies.length > 0 && (
                <div className="se-vuln-panel">
                  <div className="se-vuln-title">TECHNOLOGY STACK DETECTED</div>
                  <div className="tech-tags">
                    {/* KEY FIX: use `tech-${i}` not `tech` alone */}
                    {scanResult.technologies.map((tech, i) => (
                      <span key={`tech-${i}-${tech}`} className="tech-tag">{tech}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Threat Intelligence */}
              {scanResult.threats && scanResult.threats.length > 0 && (
                <div className="se-vuln-panel">
                  <div className="se-vuln-title">THREAT INTELLIGENCE</div>
                  <div className="se-vuln-list">
                    {/* KEY FIX: use `threat-${i}` not `threat.technology` */}
                    {scanResult.threats.map((threat, i) => (
                      <div key={`threat-${i}-${threat.technology}`} className="se-vuln-item">
                        <div className="se-vuln-info">
                          <div className="se-vuln-name">{threat.technology}</div>
                          <div className="se-vuln-detail">{threat.risk}</div>
                          {threat.cve && (
                            <div style={{ fontSize: "0.65rem", color: "#00FF9C", marginTop: "4px", fontFamily: "monospace" }}>
                              {threat.cve}
                            </div>
                          )}
                        </div>
                        <span className="se-vuln-badge" style={{ color: SEV[threat.severity.toUpperCase()]?.color ?? "#facc15", borderColor: SEV[threat.severity.toUpperCase()]?.border ?? "rgba(255,255,255,0.2)" }}>
                          {threat.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Discovered Admin Panels */}
              {scanResult.discoveredPanels && scanResult.discoveredPanels.length > 0 && (
                <div className="se-vuln-panel">
                  <div className="se-vuln-title">DISCOVERED ADMIN PANELS</div>
                  <div className="tech-tags">
                    {/* KEY FIX: use `panel-${i}` not `panel` */}
                    {scanResult.discoveredPanels.map((panel, i) => (
                      <span key={`panel-${i}-${panel}`} className="tech-tag" style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}>
                        ⚠ {panel}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Vulnerability Matrix */}
              <div className="se-vuln-panel">
                <div className="se-vuln-title">
                  ▦ VULNERABILITY MATRIX
                  <span className="se-vuln-count">{scanResult.vulnerabilities.length} ISSUES FOUND</span>
                </div>
                <div className="se-vuln-list">
                  {/* KEY FIX: use `vuln-${i}` — name alone causes duplicates with multiple admin panels */}
                  {scanResult.vulnerabilities.map((vuln, i) => (
                    <motion.div
                      key={`vuln-${i}-${vuln.severity}`}
                      className="se-vuln-item"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      style={{ borderColor: SEV[vuln.severity]?.border + "33" }}
                      onClick={() => setActiveVuln(vuln)}
                      whileHover={{ borderColor: SEV[vuln.severity]?.border }}
                    >
                      <span className="se-vuln-icon" style={{ color: SEV[vuln.severity]?.color }}>{SEV[vuln.severity]?.icon}</span>
                      <div className="se-vuln-info">
                        <p className="se-vuln-name">{vuln.name}</p>
                        <p className="se-vuln-detail">{vuln.detail}</p>
                        {vuln.proof && <p className="se-vuln-proof">▸ {vuln.proof}</p>}
                      </div>
                      <span className="se-vuln-badge" style={{ color: SEV[vuln.severity]?.color, borderColor: SEV[vuln.severity]?.border, background: SEV[vuln.severity]?.bg }}>
                        {vuln.severity}
                      </span>
                      <span className="se-arrow">›</span>
                    </motion.div>
                  ))}
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── VULN DETAIL MODAL ── */}
      <AnimatePresence>
        {activeVuln && (
          <motion.div className="se-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveVuln(null)}>
            <motion.div className="se-modal" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} onClick={(e) => e.stopPropagation()}>
              <button className="se-modal-close" onClick={() => setActiveVuln(null)}>✕</button>

              <div className="se-modal-title" style={{ color: SEV[activeVuln.severity]?.color }}>
                {SEV[activeVuln.severity]?.icon} {activeVuln.name}
              </div>

              <span className="se-modal-label">SEVERITY</span>
              <span className="se-vuln-badge" style={{ display: "inline-block", marginBottom: 4, fontSize: "0.68rem", padding: "4px 12px", color: SEV[activeVuln.severity]?.color, borderColor: SEV[activeVuln.severity]?.border, background: SEV[activeVuln.severity]?.bg }}>
                {activeVuln.severity}
              </span>

              {activeVuln.cve && (
                <>
                  <span className="se-modal-label">CVE REFERENCE</span>
                  <span className="se-modal-val" style={{ color: "#22d3ee" }}>{activeVuln.cve}</span>
                </>
              )}

              <span className="se-modal-label">FINDING</span>
              <span className="se-modal-val">{activeVuln.detail}</span>

              {activeVuln.proof && (
                <>
                  <span className="se-modal-label">PROOF OF EXPLOIT</span>
                  <div className="se-proof-box">{activeVuln.proof}</div>
                </>
              )}

              <span className="se-modal-label">⚡ AI RECOMMENDED FIX</span>
              <div className="se-fix-box">{getAIFix(activeVuln)}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}